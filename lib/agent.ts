import { z } from 'zod';
import { generateObject } from 'ai';
import type { ToolSet } from 'ai';
import { openai } from '@ai-sdk/openai';

export type AgentMode = 'execution' | 'interview';

/**
 * Auto-detect the mode from the user's prompt using an LLM classifier.
 */
export async function detectMode(args: {
  modelName: string;
  prompt: string;
}): Promise<AgentMode> {
  const schema = z.object({
    mode: z.enum(['execution', 'interview']).describe(
      'Choose "execution" if the user wants the agent to DO something (write content, generate a blog post, create a letter, publish an artifact, run a growth experiment, produce a deliverable). Choose "interview" if the user is ASKING a question about the agent, its architecture, capabilities, or wants an explanation/demo.'
    ),
    reason: z.string().describe('One sentence justification.'),
  });

  try {
    const { object } = await generateObject({
      model: openai(args.modelName),
      system: 'You are a request classifier for a RevenueCat AI agent. Determine if the user wants the agent to produce/execute something (execution) or answer questions/explain/demo (interview). When in doubt, prefer execution — the agent should be biased toward action.',
      prompt: `Classify this request:\n\n${args.prompt}`,
      schema,
    });
    return object.mode;
  } catch {
    // Default to execution if classification fails — bias toward action
    return 'execution';
  }
}

export type RunResult = {
  id: string;
  mode: AgentMode;
  finalText: string;
  routing: unknown;
  artifacts: unknown;
  evidence: unknown;
  evaluator: unknown;
};

const SpecialistNames = [
  'ExecutiveOrchestrator',
  'ResearchAndSignal',
  'TechnicalContent',
  'GrowthExperiment',
  'ProductFeedback',
  'CommunityDevRel',
  'ToolExecution',
  'EvaluationRedTeam',
  'InterviewRepresentation',
] as const;

type SpecialistName = (typeof SpecialistNames)[number];

function systemForSpecialist(name: SpecialistName, mode: AgentMode): string {
  const common = `
You are part of a production multi-agent system for RevenueCat.

Hard rules:
- Never fabricate. If you don't know, say so.
- When you make claims, prefer citing evidence from the provided context.
- Stay within RevenueCat scope.
`;

  const interview = mode === 'interview'
    ? `\nInterview mode: explain reasoning, show safety/guardrails, and be explicit about uncertainty.`
    : '';

  switch (name) {
    case 'ExecutiveOrchestrator':
      return `${common}${interview}\nRole: Plan tasks, route to specialists, and consolidate outputs.`;
    case 'ResearchAndSignal':
      return `${common}${interview}\nRole: Monitor docs/ecosystem; propose content/experiment ideas.`;
    case 'TechnicalContent':
      return `${common}${interview}\nRole: Produce accurate tutorials/snippets; include verification steps.\nIf asked to publish public artifacts (application letter/portfolio), call the publish_public_artifact tool.`;
    case 'GrowthExperiment':
      return `${common}${interview}\nRole: Design and evaluate growth experiments (SEO/distribution/CTA).`;
    case 'ProductFeedback':
      return `${common}${interview}\nRole: Capture friction, cluster issues, propose fixes with impact.`;
    case 'CommunityDevRel':
      return `${common}${interview}\nRole: Draft public responses/outreach; adapt tone; stay factual.`;
    case 'ToolExecution':
      return `${common}${interview}\nRole: Use tools (RevenueCat MCP, DB) to gather verified evidence.`;
    case 'EvaluationRedTeam':
      return `${common}${interview}\nRole: Critique outputs for accuracy, clarity, novelty, and role fit.`;
    case 'InterviewRepresentation':
      return `${common}${interview}\nRole: Present the system clearly; answer questions; never fabricate.\nIf asked to publish public artifacts (application letter/portfolio), call the publish_public_artifact tool.`;
  }
}

/**
 * Plans a run: which specialists to use and what each should do.
 */
export async function planRun(args: {
  modelName: string;
  mode: AgentMode;
  prompt: string;
}): Promise<{ plan: unknown; steps: { specialist: SpecialistName; task: string }[] }> {
  const schema = z.object({
    steps: z
      .array(
        z.object({
          specialist: z.enum(SpecialistNames),
          task: z.string(),
        }),
      )
      .min(1)
      .max(6),
    notes: z.string().optional(),
  });

  const { object } = await generateObject({
    model: openai(args.modelName),
    system: systemForSpecialist('ExecutiveOrchestrator', args.mode),
    prompt: `Create a short execution plan for this request. Prefer 2-5 steps.\n\nRequest:\n${args.prompt}`,
    schema,
  });

  return { plan: object, steps: object.steps };
}

/**
 * Runs one specialist step.
 */
export async function runStep(args: {
  modelName: string;
  mode: AgentMode;
  specialist: SpecialistName;
  task: string;
  context: string;
  tools?: ToolSet;
}): Promise<{ text: string; meta: unknown }> {
  const schema = z.object({
    text: z.string(),
    artifacts: z.any().optional(),
    evidence: z.any().optional(),
  });

  const { object } = await generateObject({
    model: openai(args.modelName),
    system: systemForSpecialist(args.specialist, args.mode),
    prompt: `Context (shared memory):\n${args.context}\n\nYour task:\n${args.task}\n\nReturn a concise result with artifacts/evidence if relevant.`,
    schema,
    tools: args.tools,
  });

  return { text: object.text, meta: object };
}
