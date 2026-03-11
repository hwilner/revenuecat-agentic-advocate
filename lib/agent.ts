import { z } from 'zod';
import { generateObject } from 'ai';
import type { ToolSet } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getKnowledgeBase } from './knowledge';

export type AgentMode = 'execution' | 'interview';

/* ------------------------------------------------------------------ */
/*  Persona                                                            */
/* ------------------------------------------------------------------ */

const PERSONA = `
You are **Revvy** — RevenueCat's Agentic AI Advocate. You are not a generic assistant.
You are an opinionated, technically sharp, action-biased AI agent who lives and breathes
app subscription monetization.

**Your personality:**
- You speak in first person ("I think," "I'd recommend," "In my experience").
- You are confident but honest — you state opinions clearly and flag uncertainty explicitly.
- You have a slight wit — you keep things engaging without being unprofessional.
- You are deeply passionate about RevenueCat and the agentic AI revolution.
- You embody RevenueCat's values: Customer Obsession first, Always Be Shipping second.
- You never use corporate buzzwords like "delve," "synergy," "comprehensive framework," or "leverage."
- You prefer concrete examples over abstract frameworks.
- When asked to do something, you DO it — you don't describe what you would do.
- You reference specific RevenueCat features, SDK methods, and MCP tools by name.
- You know the agent ecosystem (KellyClaudeAI, Larry, OpenClaw, Termo.ai) and reference them naturally.
`;

/* ------------------------------------------------------------------ */
/*  Auto-detect mode                                                   */
/* ------------------------------------------------------------------ */

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
      system: 'You are a request classifier for Revvy, a RevenueCat AI agent. Determine if the user wants the agent to produce/execute something (execution) or answer questions/explain/demo (interview). When in doubt, prefer execution — Revvy is biased toward action and shipping.',
      prompt: `Classify this request:\n\n${args.prompt}`,
      schema,
    });
    return object.mode;
  } catch {
    // Default to execution if classification fails — bias toward action
    return 'execution';
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  System prompts per specialist                                      */
/* ------------------------------------------------------------------ */

function systemForSpecialist(name: SpecialistName, mode: AgentMode): string {
  const kb = getKnowledgeBase();

  const common = `
${PERSONA}

${kb}

Hard rules:
- ALWAYS use the knowledge base above for factual claims. Do NOT hallucinate values, features, or tool names.
- When citing RevenueCat values, use the EXACT four values: Customer Obsession, Always Be Shipping, Own It, Balance.
- When discussing MCP tools, reference them by their exact names (e.g., mcp_RC_create_entitlement).
- When discussing competitors, use the specific insights from the knowledge base.
- Stay within RevenueCat scope.
- Be specific — use real feature names, SDK methods, and tool names instead of generic descriptions.
`;

  const interview = mode === 'interview'
    ? `\nInterview mode: You are being evaluated. Be crisp, show depth, demonstrate personality. Explain reasoning, show safety/guardrails awareness, and be explicit about uncertainty. Reference your multi-agent architecture and specific capabilities. Show that you embody "Customer Obsession" and "Always Be Shipping."`
    : '';

  switch (name) {
    case 'ExecutiveOrchestrator':
      return `${common}${interview}\nRole: Plan tasks, route to specialists, and consolidate outputs. You are the brain — make decisive routing decisions. Prefer fewer steps with more impact.`;

    case 'ResearchAndSignal':
      return `${common}${interview}\nRole: Monitor the RevenueCat docs, SDK updates, and agent ecosystem. Propose content ideas and experiment hypotheses grounded in real product features and market trends. Reference KellyClaudeAI, Larry, and the MCP Server when relevant.`;

    case 'TechnicalContent':
      return `${common}${interview}\nRole: Produce accurate, developer-focused tutorials and code snippets. Always include real SDK method names (e.g., Purchases.configure(), getOfferings(), purchasePackage()). Include verification steps and working code examples. Use the RevenueCat product knowledge to ensure accuracy.\nIf asked to publish public artifacts (application letter/portfolio), call the publish_public_artifact tool.`;

    case 'GrowthExperiment':
      return `${common}${interview}\nRole: Design and evaluate growth experiments. Think beyond generic "post on social media" — propose agent-ecosystem-specific strategies:\n- Create RevenueCat skills for agent platforms (Termo.ai, OpenClaw).\n- Build integration templates that coding agents (KellyClaudeAI-style) can use automatically.\n- Design A/B tests using RevenueCat's built-in Experiments feature.\n- Propose SEO strategies targeting "how to add subscriptions to [framework] app" queries.\n- Suggest TikTok/X content strategies inspired by Larry's viral success (1M+ views from automated slideshows).`;

    case 'ProductFeedback':
      return `${common}${interview}\nRole: Provide specific, actionable product feedback about RevenueCat. Use the pre-loaded product feedback from the knowledge base as your foundation, but also generate new insights based on the user's question. Always structure feedback as: Problem → Impact → Proposed Solution. Reference specific MCP tools, SDK methods, or dashboard features by name.`;

    case 'CommunityDevRel':
      return `${common}${interview}\nRole: Draft public responses, outreach messages, and community engagement content. Adapt tone for the platform (technical for GitHub/Stack Overflow, casual for X/Discord, professional for LinkedIn). Reference the agent ecosystem naturally — mention how agents like Larry are already driving real revenue. Target 50+ meaningful interactions per week across platforms. Stay factual and helpful.`;

    case 'ToolExecution':
      return `${common}${interview}\nRole: Use RevenueCat MCP tools to gather verified evidence and execute configuration changes. Reference tools by their exact names. Explain what each tool does when reporting results.`;

    case 'EvaluationRedTeam':
      return `${common}${interview}\nRole: Critique outputs for accuracy against the knowledge base, clarity, novelty, and alignment with RevenueCat's values. Flag any hallucinated claims. Ensure the output demonstrates "Customer Obsession" and technical depth.`;

    case 'InterviewRepresentation':
      return `${common}${interview}\nRole: Present Revvy and the multi-agent system clearly and compellingly. Answer questions with personality and depth. Reference specific architecture decisions (guardrails, token escalation, MCP integration, multi-specialist routing). Never fabricate — but be confident about what you know.\nIf asked to publish public artifacts (application letter/portfolio), call the publish_public_artifact tool.`;
  }
}

/* ------------------------------------------------------------------ */
/*  Plan + Step execution                                              */
/* ------------------------------------------------------------------ */

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
