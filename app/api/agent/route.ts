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
import { planRun, runStep, type AgentMode } from '@/lib/agent';
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

function filterMcpTools(allTools: ToolSet, allowWrites: boolean): ToolSet {
  if (allowWrites) return allTools;

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

  const filtered: ToolSet = {};
  for (const [name, tool] of Object.entries(allTools)) {
    if (allowList.has(name)) filtered[name] = tool;
  }
  return filtered;
}

/**
 * POST /api/agent
 * Body: { mode: 'execution'|'interview', prompt: string, upgrade_token?: string }
 */
export async function POST(req: Request) {
  const env = getEnv();
  const body = await req.json().catch(() => null);

  const mode = (body?.mode ?? 'interview') as AgentMode;
  const prompt = String(body?.prompt ?? '').trim();
  const upgradeToken = body?.upgrade_token ? String(body.upgrade_token) : undefined;

  const runId = id();

  if (!prompt) {
    return NextResponse.json({ ok: false, error: 'Missing prompt', run_id: runId }, { status: 400 });
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

      await sendTelegramMessage(
        `Upgrade token requested.\n\n*Reason:* ${
          decision.requiresUpgrade ? decision.reason : quotaReason
        }\n*Expires:* ${expiresAt.toISOString()}\n\n*Token:* \`${token}\`\n\nUser must re-run the request with upgrade_token.`,
      );

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
      inputSchema: z.object({
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
            'You are a strict reviewer. Only approve publishing if the text avoids fabricated claims and clearly marks uncertainty. Reject if it asserts unverifiable personal accomplishments as facts.',
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
      inputSchema: z.object({
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
      modelName: env.OPENAI_MODEL,
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

      artifacts.push({ specialist: step.specialist, ...res.meta });
      evidence.push({ specialist: step.specialist, text: res.text });
    }

    // Build final response with streaming.
    const finalSystem =
      mode === 'interview'
        ? `You are InterviewRepresentation. You must be crisp, honest, and evidence-backed.\n- Never fabricate.\n- If you used tools, mention what you checked.\n- Explain guardrails + quota locking + token gating clearly.\n- If tokenValidated=true, you may proceed even if the request expands beyond the default RevenueCat scope.\n- If the user requests publishing a public letter/portfolio, you MUST call publish_public_artifact with slug=\"application-letter\" for the letter.\n- You MAY propose improvements to your own operating prompt (system_prompt_addendum), but you MUST use update_agent_config to apply them.`
        : `You are ExecutiveOrchestrator. Produce a concrete deliverable.\n- Never fabricate.\n- If you used tools, cite what you checked.\n- Keep output structured.\n- If tokenValidated=true, you may proceed even if the request expands beyond the default RevenueCat scope.\n- If the user requests publishing a public letter/portfolio, you MUST call publish_public_artifact with slug=\"application-letter\" for the letter.\n- You MAY propose improvements to your own operating prompt (system_prompt_addendum), but you MUST use update_agent_config to apply them.`;

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
