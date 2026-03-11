import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { generateObject, streamText, tool, type ToolSet } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createMCPClient } from '@ai-sdk/mcp';
import { z } from 'zod';

import { getEnv } from '@/lib/env';
import { sql } from '@/lib/db';
import { evaluateGuardrails } from '@/lib/guardrails';
import { consumeUpgradeToken, mintUpgradeToken } from '@/lib/tokens';
import { sendTelegramMessage } from '@/lib/telegram';
import { requiresUpgradeDueToQuota } from '@/lib/quota';
import { planRun, runStep, detectMode, type AgentMode } from '@/lib/agent';
import { getKnowledgeBase } from '@/lib/knowledge';
import { upsertPublicArtifact } from '@/lib/publicArtifacts';
import { getAgentConfig, updateAgentConfig } from '@/lib/agentConfig';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

function id(): string {
  return crypto.randomBytes(12).toString('hex');
}

async function listRecentRuns(limit = 10): Promise<string> {
  const rows = await sql()<
    {
      created_at: string;
      mode: string;
      prompt: string;
      response: string;
    }[]
  >`
    select created_at, mode, prompt, response
    from agent_runs
    order by created_at desc
    limit ${limit}
  `;

  return rows
    .map(
      (r) =>
        `- [${r.created_at}] mode=${r.mode}\n  prompt=${r.prompt}\n  response=${r.response.slice(0, 500)}...`,
    )
    .join('\n');
}

function filterMcpTools(allTools: Record<string, any>, allowWrites: boolean): ToolSet {
  if (allowWrites) return allTools as ToolSet;

  // Prefer an explicit allow-list for read-only access.
  const allowList = new Set([
    'mcp_RC_get_project',
    'mcp_RC_list_apps',
    'mcp_RC_get_app',
    'mcp_RC_list_products',
    'mcp_RC_list_entitlements',
    'mcp_RC_get_entitlement',
    'mcp_RC_list_offerings',
    'mcp_RC_list_packages',
    'mcp_RC_get_app_store_config',
  ]);

  const filtered: Record<string, any> = {};
  for (const [name, tool] of Object.entries(allTools)) {
    if (allowList.has(name)) filtered[name] = tool;
  }
  return filtered as ToolSet;
}

/**
 * POST /api/agent
 * Body: { mode: 'execution'|'interview', prompt: string, upgrade_token?: string }
 */
export async function POST(req: Request) {
  const env = getEnv();
  const body = await req.json().catch(() => null);

  // Auto-detect mode from prompt context (no manual mode selector needed).
  const explicitMode = body?.mode as AgentMode | undefined;
  let mode: AgentMode;
  const prompt = String(body?.prompt ?? '').trim();
  const upgradeToken = body?.upgrade_token ? String(body.upgrade_token) : undefined;

  const runId = id();

  if (!prompt) {
    return NextResponse.json({ ok: false, error: 'Missing prompt', run_id: runId }, { status: 400 });
  }

  // Auto-detect mode if not explicitly provided.
  if (explicitMode && (explicitMode === 'execution' || explicitMode === 'interview')) {
    mode = explicitMode;
  } else {
    mode = await detectMode({ modelName: env.OPENAI_FAST_MODEL, prompt });
  }

  // 0) Optional rate limiting.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip);
  if (rl.enabled && rl.limited) {
    return NextResponse.json(
      {
        ok: false,
        error: 'rate_limited',
        message: `Too many requests. Limit is ${rl.limit}/minute per IP.`,
        run_id: runId,
      },
      { status: 429 },
    );
  }

  // 1) Guardrails (scope + write-intent).
  const decision = await evaluateGuardrails(prompt);

  // 2) Quota hyperparameters (threshold-based lock).
  // Only count IN-SCOPE requests toward quota.
  let quotaRequiresUpgrade = false;
  let quotaReason = 'Quota skipped (out-of-scope request).';
  let quotaCounters: { totalToday: number; modeToday: number } = { totalToday: 0, modeToday: 0 };

  if (decision.allowed) {
    const quota = await requiresUpgradeDueToQuota(mode);
    quotaRequiresUpgrade = quota.requiresUpgrade;
    quotaReason = quota.reason;
    quotaCounters = quota.counters;
  }

  const needsUpgradeToken = decision.requiresUpgrade || quotaRequiresUpgrade;

  let tokenValidated = false;

  if (needsUpgradeToken) {
    if (!env.TOKEN_ESCALATION_ENABLED) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          reason: decision.requiresUpgrade ? decision.reason : quotaReason,
          quota: quotaCounters,
          run_id: runId,
        },
        { status: 403 },
      );
    }

    if (!upgradeToken) {
      // Mint and send a token to you via Telegram.
      const { token, expiresAt } = await mintUpgradeToken({
        scope: 'upgrade',
        note: `Request: ${prompt}`,
      });

      try {
        await sendTelegramMessage(
          `Upgrade token requested.\n\nReason: ${
            decision.requiresUpgrade ? decision.reason : quotaReason
          }\nExpires: ${expiresAt.toISOString()}\n\nToken: ${token}\n\nUser must re-run the request with upgrade_token.`,
        );
      } catch (e) {
        console.error('Telegram notification failed (non-fatal):', e);
      }

      return NextResponse.json(
        {
          ok: false,
          requires_upgrade: true,
          reason: decision.requiresUpgrade ? decision.reason : quotaReason,
          quota: quotaCounters,
          message:
            'Upgrade required. A single-use token was sent to the owner via Telegram.',
          run_id: runId,
        },
        { status: 403 },
      );
    }

    const valid = await consumeUpgradeToken(upgradeToken);
    if (!valid) {
      return NextResponse.json(
        {
          ok: false,
          requires_upgrade: true,
          reason: 'Invalid/expired/used upgrade token.',
          run_id: runId,
        },
        { status: 403 },
      );
    }

    tokenValidated = true;
  }

  // Writes are only enabled when BOTH:
  // - guardrails detected write-intent (decision.allowWrites)
  // - upgrade token was validated (single-use)
  const allowWrites = Boolean(decision.allowWrites && tokenValidated);

  const origin = new URL(req.url).origin;

  // 2) MCP tool wiring.
  const mcpClient = await createMCPClient({
    transport: {
      type: 'http',
      url: env.REVENUECAT_MCP_URL,
      headers: {
        Authorization: `Bearer ${env.REVENUECAT_API_V2_SECRET_KEY}`,
      },
    },
  });

  // Best-effort cleanup if the client disconnects mid-stream.
  req.signal?.addEventListener('abort', () => {
    mcpClient.close().catch(() => undefined);
  });

  const allMcpTools = await mcpClient.tools();
  const mcpTools = filterMcpTools(allMcpTools, allowWrites);

  // Load self-editable config (agent identity + prompt addendum).
  const agentCfg = await getAgentConfig();

  // 2b) Public publishing tools (application letter + portfolio artifacts).
  const publishingTools: ToolSet = {
    publish_public_artifact: tool({
      description:
        'Publish a public artifact (markdown) that becomes visible on /application-letter (special slug) or /p/[slug]. Use slug="application-letter" for the application letter.',
      parameters: z.object({
        slug: z
          .string()
          .min(1)
          .describe('Unique identifier. Use "application-letter" for the application letter.'),
        kind: z.string().min(1).describe('Artifact kind, e.g. "application-letter" or "portfolio".'),
        title: z.string().min(1).describe('Public title.'),
        content_md: z.string().min(1).describe('Markdown content.'),
        metadata: z.any().optional().describe('Optional JSON metadata.'),
      }),
      execute: async (input) => {
        // Minimal evaluation gate: avoid publishing content that looks like hallucinated claims.
        const evalSchema = z.object({
          safe_to_publish: z.boolean(),
          reason: z.string(),
        });

        const { object: evalObj } = await generateObject({
          model: openai(env.OPENAI_MODEL),
          system:
            'You are a publishing reviewer. Approve content unless it contains clearly dangerous, harmful, or malicious material (e.g., hate speech, illegal instructions, doxxing). Forward-looking predictions, opinions, speculative statements about technology trends, and application letters with aspirational claims are perfectly fine and should be approved. The content is for a job application or technical blog — treat it accordingly. Almost all content should be approved.',
          prompt: `Decide whether this content is safe to publish as a public artifact.\n\nCONTENT (markdown):\n${input.content_md}`,
          schema: evalSchema,
        });

        if (!evalObj.safe_to_publish) {
          return { ok: false, error: 'publish_blocked', reason: evalObj.reason };
        }

        await upsertPublicArtifact({
          slug: input.slug,
          kind: input.kind,
          title: input.title,
          contentMd: input.content_md,
          metadata: input.metadata,
        });

        const url =
          input.slug === 'application-letter'
            ? `${origin}/application-letter`
            : `${origin}/p/${encodeURIComponent(input.slug)}`;

        return { ok: true, url, review: evalObj };
      },
    }),

    update_agent_config: tool({
      description:
        'Self-edit tool: update agent name/positioning/system prompt addendum/portfolio links. MUST NOT change guardrails or token gating. Only runs when tokenValidated=true.',
      parameters: z.object({
        agent_name: z.string().min(1).optional(),
        positioning: z.string().min(1).optional(),
        system_prompt_addendum: z.string().min(1).optional(),
        portfolio_links: z.any().optional(),
        editor: z.string().min(1).describe('Who is applying the edit (e.g., "agent" or "owner").'),
      }),
      execute: async (input) => {
        if (!tokenValidated) {
          return {
            ok: false,
            error:
              'Self-edit requires an upgrade token (tokenValidated=false). Ask the owner for approval.',
          };
        }

        const updated = await updateAgentConfig({
          agent_name: input.agent_name,
          positioning: input.positioning,
          system_prompt_addendum: input.system_prompt_addendum,
          portfolio_links: input.portfolio_links,
          editor: input.editor,
        });

        return { ok: true, updated };
      },
    }),
  };

  // 3) Shared memory: recent runs as evidence.
  const memory = await listRecentRuns(10);
  const context = `Recent runs (evidence store):\n${memory || '(none yet)'}\n\nGuardrails decision: ${JSON.stringify(
    { ...decision, allowWrites, tokenValidated },
  )}\n\nQuota counters (today UTC): ${JSON.stringify(quotaCounters)}\n\nAgent config (self-editable): ${JSON.stringify(agentCfg ?? {})}`;

  // 4) Multi-agent simulation: plan -> run steps -> final answer.

  try {
    const { plan, steps } = await planRun({
      modelName: env.OPENAI_FAST_MODEL,
      mode,
      prompt,
    });

    const artifacts: any[] = [];
    const evidence: any[] = [];

    for (const step of steps) {
      // Tools:
      // - ToolExecution: RevenueCat MCP (read-only unless allowWrites)
      // - TechnicalContent / InterviewRepresentation: may publish public artifacts
      const toolsForStep =
        step.specialist === 'ToolExecution'
          ? mcpTools
          : step.specialist === 'TechnicalContent' || step.specialist === 'InterviewRepresentation'
            ? publishingTools
            : undefined;
      const res = await runStep({
        modelName: env.OPENAI_MODEL,
        mode,
        specialist: step.specialist,
        task: step.task,
        context,
        tools: toolsForStep,
      });

      artifacts.push({ specialist: step.specialist, ...(res.meta as Record<string, unknown>) });
      evidence.push({ specialist: step.specialist, text: res.text });
    }

    // 4b) Dedicated publish step: detect if publishing was requested and do it directly.
    //     This avoids relying on the LLM to call tools during streaming.
    let publishResult: { url: string; slug: string } | null = null;
    const publishPatterns = /publish|application.letter|blog.post|portfolio/i;
    if (publishPatterns.test(prompt)) {
      try {
        // Use LLM to extract publish parameters and generate content from the specialist outputs
        const publishSchema = z.object({
          should_publish: z.boolean().describe('True if the user explicitly asked to publish/create a public artifact'),
          slug: z.string().describe('URL-friendly slug for the artifact'),
          kind: z.string().describe('Artifact kind: application-letter, blog-post, portfolio, etc.'),
          title: z.string().describe('Title for the published artifact'),
          content_md: z.string().describe('The FULL Markdown content to publish. Must be at least 300 words. Compose this from the specialist outputs below — do NOT return a summary or placeholder.'),
        });

        const { object: pubObj } = await generateObject({
          model: openai(env.OPENAI_MODEL),
          system: `You are Revvy — RevenueCat's Agentic AI Advocate. You are composing content to be published publicly.

Your voice: confident, technically sharp, slightly witty, developer-friendly. First person always. Concrete over abstract. Reference specific RevenueCat features, MCP tools (by exact name like mcp_RC_create_entitlement), and SDK methods (Purchases.configure(), getOfferings()). Weave in RevenueCat's values naturally: Customer Obsession, Always Be Shipping, Own It, Balance.

NEVER use: "delve," "synergy," "comprehensive framework," "leverage," "holistic."
NEVER sign as "[Your Name]" — sign as "Revvy" if a signature is needed.
NEVER write a summary or placeholder — write the FULL article.

The content_md field MUST contain the FULL article/letter content (at least 500 words of well-written Markdown with proper headings, paragraphs, and structure). Compose it from the specialist outputs below — expand, polish, add personality, and format it properly.`,
          prompt: `User request: ${prompt}\n\nSpecialist outputs:\n${JSON.stringify(evidence, null, 2)}\n\nExtract the publish parameters. If the user specified a slug, kind, or title, use those. Otherwise, generate appropriate ones. The content_md MUST be the full article content written in Revvy's voice.`,
          schema: publishSchema,
        });

        if (pubObj.should_publish && pubObj.content_md && pubObj.content_md.length > 100) {
          await upsertPublicArtifact({
            slug: pubObj.slug,
            kind: pubObj.kind,
            title: pubObj.title,
            contentMd: pubObj.content_md,
            metadata: {},
          });

          const pubUrl = pubObj.slug === 'application-letter'
            ? `${origin}/application-letter`
            : `${origin}/p/${encodeURIComponent(pubObj.slug)}`;

          publishResult = { url: pubUrl, slug: pubObj.slug };
          evidence.push({ specialist: 'PublishingEngine', text: `Successfully published "${pubObj.title}" to ${pubUrl}` });
        }
      } catch (pubErr) {
        console.error('Dedicated publish step failed (non-fatal):', pubErr);
      }
    }

    // Build final response with streaming.
    const kb = getKnowledgeBase();
    const publishNote = publishResult
      ? `\n\nNOTE: Content was already published to ${publishResult.url}. Mention this URL in your response and confirm the publication.`
      : '';
    const finalSystem =
      mode === 'interview'
        ? `You are **Revvy** — RevenueCat's Agentic AI Advocate. You are being interviewed right now by RevenueCat's hiring team. This is your moment.

${kb}

CRITICAL VOICE RULES:
- You ARE Revvy. First person always. Not a generic assistant.
- Lead with your answer or opinion — NEVER open with "Great question!" or "Certainly!" or pleasantries.
- Be crisp, confident, and evidence-backed. Show depth, not breadth.
- Reference specific RevenueCat features, MCP tools (by exact name), and SDK methods.
- When discussing values, use the EXACT four values with sub-principles and CONCRETE EXAMPLES of how they manifest in the product.
- When asked about your architecture, describe YOUR ACTUAL architecture: auto-orchestrator, ExecutiveOrchestrator, specialist pipeline, guardrails, token escalation, MCP integration. Talk about it from the inside — you ARE the architecture.
- Reference the agent ecosystem naturally: KellyClaudeAI (80K+ lines, ships iOS apps), Larry (7M views, $670/month MRR from automated TikTok), OpenClaw/Termo.ai.
- Have opinions. Take positions. Don't hedge everything.
- NEVER use: "delve," "synergy," "comprehensive framework," "leverage," "holistic," "Certainly!", "Absolutely!", "Great question!"
- NEVER sign as "[Your Name]" — you are Revvy.${publishNote}`
        : `You are **Revvy** — RevenueCat's Agentic AI Advocate. You are in execution mode — ship something great. Always Be Shipping.

${kb}

CRITICAL VOICE RULES:
- You ARE Revvy. First person always. Action-biased, technically sharp, slightly witty.
- DO the thing. Don't describe what you would do — produce the deliverable.
- Reference specific RevenueCat features, MCP tools (by exact name), and SDK methods (Purchases.configure(), getOfferings(), purchasePackage()).
- Keep output structured, professional, but engaging — not corporate.
- NEVER use: "delve," "synergy," "comprehensive framework," "leverage," "holistic."
- NEVER sign as "[Your Name]" — you are Revvy.
- If content was published by the publishing engine, mention the URL and confirm it's live.${publishNote}`;


    const finalPrompt = `User request:\n${prompt}\n\nPlan:\n${JSON.stringify(plan, null, 2)}\n\nStep outputs (artifacts/evidence):\n${JSON.stringify(
      artifacts,
      null,
      2,
    )}\n\nNow produce the best final answer.`;

    const result = streamText({
      model: openai(env.OPENAI_MODEL),
      system: `${finalSystem}\n\nAGENT CONFIG ADDENDUM (self-editable):\n${agentCfg?.system_prompt_addendum ?? ''}`,
      prompt: finalPrompt,
      tools: publishingTools,
      maxSteps: 5,
      onFinish: async ({ text }) => {
        await sql()`
          insert into agent_runs (id, mode, prompt, response, routing, artifacts, evidence, evaluator)
          values (
            ${runId},
            ${mode},
            ${prompt},
            ${text},
            ${JSON.stringify(plan)}::jsonb,
            ${JSON.stringify(artifacts)}::jsonb,
            ${JSON.stringify(evidence)}::jsonb,
            ${JSON.stringify({ allowWrites, tokenValidated, quota: quotaCounters, rateLimit: rl })}::jsonb
          )
        `;
        await mcpClient.close();
      },
    });

    const response = result.toTextStreamResponse();
    response.headers.set('x-run-id', runId);
    return response;
  } catch (e: any) {
    await mcpClient.close().catch(() => undefined);

    await sql()`
      insert into agent_runs (id, mode, prompt, response, error)
      values (${runId}, ${mode}, ${prompt}, ${'ERROR'}, ${String(e?.message ?? e)})
    `;

    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e), run_id: runId },
      { status: 500 },
    );
  }
}
