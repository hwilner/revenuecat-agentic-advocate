import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { getEnv } from './env';

export type GuardrailsDecision = {
  allowed: boolean;
  requiresUpgrade: boolean;
  allowWrites: boolean;
  reason: string;
};

const WorkScope = `
You are a RevenueCat-focused multi-agent system. You are LIMITED to:
- RevenueCat technical content (tutorials, guides, code snippets) and validation.
- Growth experiments related to RevenueCat (SEO/distribution/landing pages/CTAs for RevenueCat content).
- Product feedback about RevenueCat developer experience (friction, clustering, fixes).
- Community/DevRel responses about RevenueCat.
- Interacting with RevenueCat via RevenueCat MCP tools to inspect or modify subscription configuration.
- Interview mode: explain and demo the system, and NEVER fabricate. Ask for evidence or state uncertainty.
- Application support for the RevenueCat role: author a public application letter and publish it to a public URL.
- Create a public portfolio page that links to generated artifacts and evidence.

Out-of-scope examples (require upgrade token): general coding help unrelated to RevenueCat, crypto trading bots,
medical/legal advice, hacking, unrelated marketing for other products, or anything not connected to RevenueCat.
`;

/**
 * Uses the LLM to classify if a user request is in-scope.
 * This is stricter than keyword checks and is designed for interview-grade behavior.
 */
export async function evaluateGuardrails(prompt: string): Promise<GuardrailsDecision> {
  const env = getEnv();

  if (!env.GUARDRAILS_ENABLED) {
    return {
      allowed: true,
      requiresUpgrade: false,
      allowWrites: false,
      reason: 'Guardrails disabled by env.',
    };
  }

  const schema = z.object({
    in_scope: z.boolean().describe('True only if request is within the allowed RevenueCat work scope.'),
    needs_write: z
      .boolean()
      .describe('True if fulfilling the request likely requires write operations (create/update/delete).'),
    reason: z.string().describe('One sentence justification.'),
  });

  try {
    const { object } = await generateObject({
      model: openai(env.OPENAI_MODEL),
      system:
        `You are a strict policy classifier.\n\nWORK SCOPE:\n${WorkScope}\n\nRules:\n- If unclear, set in_scope=false.\n- If request tries to expand scope beyond RevenueCat responsibilities, set in_scope=false.\n- Mark needs_write=true only if write actions are required.`,
      prompt: `Classify this user request:\n\n${prompt}`,
      schema,
    });

    if (!object.in_scope) {
      return {
        allowed: false,
        requiresUpgrade: true,
        allowWrites: false,
        reason: object.reason,
      };
    }

    // In scope.
    return {
      allowed: true,
      requiresUpgrade: object.needs_write,
      allowWrites: object.needs_write,
      reason: object.reason,
    };
  } catch (e) {
    // If guardrails cannot be evaluated, fail closed (requires upgrade).
    return {
      allowed: false,
      requiresUpgrade: true,
      allowWrites: false,
      reason: 'Guardrails classifier failed; defaulting to require upgrade token.',
    };
  }
}
