import { z } from 'zod';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { sql } from './db';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type LearningEntry = {
  id: number;
  created_at: string;
  kind: string;
  insight: string;
  source_run_id: string | null;
  confidence: number;
  applied: boolean;
};

export type EvolutionEvent = {
  id: number;
  created_at: string;
  trigger: string;
  changes_summary: string;
  before_snapshot: unknown;
  after_snapshot: unknown;
  insights_used: number[];
};

/* ------------------------------------------------------------------ */
/*  DB Schema (called from initDb)                                     */
/* ------------------------------------------------------------------ */

export async function initLearningTables() {
  const db = sql();

  // Learning journal: individual insights extracted from interactions
  await db`
    create table if not exists learning_journal (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      kind text not null,
      insight text not null,
      source_run_id text,
      confidence real not null default 0.7,
      applied boolean not null default false,
      metadata jsonb
    )
  `;

  // Evolution log: records of when the agent self-improved
  await db`
    create table if not exists evolution_log (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      trigger text not null,
      changes_summary text not null,
      before_snapshot jsonb,
      after_snapshot jsonb,
      insights_used jsonb,
      generation integer not null default 1
    )
  `;

  // Dynamic knowledge: facts the agent learns over time (separate from static knowledge.ts)
  await db`
    create table if not exists dynamic_knowledge (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      category text not null,
      fact text not null,
      source text,
      confidence real not null default 0.8,
      active boolean not null default true
    )
  `;

  // User feedback on responses
  await db`
    create table if not exists response_feedback (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      run_id text not null,
      rating integer not null,
      comment text
    )
  `;
}

/* ------------------------------------------------------------------ */
/*  Post-Interaction Reflection                                        */
/* ------------------------------------------------------------------ */

/**
 * After each interaction, the agent reflects on what it learned.
 * This runs asynchronously (fire-and-forget) so it doesn't slow responses.
 */
export async function reflectOnInteraction(args: {
  modelName: string;
  runId: string;
  mode: string;
  prompt: string;
  response: string;
}): Promise<void> {
  try {
    const schema = z.object({
      insights: z.array(z.object({
        kind: z.enum([
          'user_preference',     // What users tend to want
          'response_pattern',    // What works well in responses
          'knowledge_gap',       // Something the agent didn't know
          'prompt_improvement',  // How the system prompt could be better
          'new_fact',            // A new fact learned from the interaction
          'anti_pattern',        // Something to avoid in future
        ]),
        insight: z.string().describe('Concise, actionable insight (1-2 sentences)'),
        confidence: z.number().min(0).max(1).describe('How confident is this insight (0.0-1.0)'),
      })).describe('0-3 insights from this interaction. Empty array if nothing notable.'),
    });

    const { object } = await generateObject({
      model: openai(args.modelName),
      system: `You are the learning subsystem of Revvy, a RevenueCat AI agent. After each interaction, you extract actionable insights that will help Revvy improve over time.

Rules:
- Only extract genuinely useful insights — quality over quantity
- Return an empty array if the interaction was routine with nothing to learn
- Focus on patterns: what the user really wanted vs what was delivered
- Note any knowledge gaps where Revvy could have been more specific
- Note any response patterns that seemed particularly effective
- Be specific: "Users asking about MCP tools want code examples, not just tool names" is better than "Be more helpful"
- Confidence should reflect how generalizable the insight is (0.5 = maybe, 0.8 = likely, 0.95 = very confident)`,
      prompt: `Reflect on this interaction and extract 0-3 insights:

MODE: ${args.mode}
USER PROMPT: ${args.prompt}
AGENT RESPONSE (first 2000 chars): ${args.response.slice(0, 2000)}`,
      schema,
    });

    // Store insights in the learning journal
    for (const insight of object.insights) {
      await sql()`
        insert into learning_journal (kind, insight, source_run_id, confidence)
        values (${insight.kind}, ${insight.insight}, ${args.runId}, ${insight.confidence})
      `;
    }
  } catch (e) {
    // Non-fatal — learning is best-effort
    console.error('Reflection failed (non-fatal):', e);
  }
}

/* ------------------------------------------------------------------ */
/*  Self-Improvement Cycle                                             */
/* ------------------------------------------------------------------ */

/**
 * Checks if it's time for a self-improvement cycle.
 * Triggers every N interactions (configurable, default 10).
 */
export async function shouldSelfImprove(threshold = 10): Promise<boolean> {
  const rows = await sql()<{ count: string }[]>`
    select count(*)::text as count from agent_runs
    where created_at > (
      select coalesce(max(created_at), '2000-01-01'::timestamptz)
      from evolution_log
    )
  `;
  const count = parseInt(rows[0]?.count ?? '0', 10);
  return count >= threshold;
}

/**
 * Runs the self-improvement cycle:
 * 1. Loads recent learning journal entries
 * 2. Analyzes patterns across insights
 * 3. Generates prompt improvements
 * 4. Applies them to agent_config
 * 5. Logs the evolution event
 */
export async function runSelfImprovementCycle(args: {
  modelName: string;
}): Promise<{ improved: boolean; summary: string }> {
  try {
    // 1. Load unprocessed insights
    const insights = await sql()<LearningEntry[]>`
      select id, created_at, kind, insight, source_run_id, confidence, applied
      from learning_journal
      where applied = false
      order by confidence desc, created_at desc
      limit 30
    `;

    if (insights.length < 3) {
      return { improved: false, summary: 'Not enough insights to improve yet.' };
    }

    // 2. Load recent feedback
    const feedback = await sql()<{ rating: number; run_id: string; comment: string | null }[]>`
      select rating, run_id, comment
      from response_feedback
      order by created_at desc
      limit 20
    `;

    // 3. Load current agent config
    const configRows = await sql()<{ system_prompt_addendum: string | null; positioning: string | null }[]>`
      select system_prompt_addendum, positioning from agent_config where id = 1 limit 1
    `;
    const currentConfig = configRows[0] ?? { system_prompt_addendum: null, positioning: null };

    // 4. Ask the LLM to synthesize improvements
    const schema = z.object({
      should_update: z.boolean().describe('True if there are meaningful improvements to make'),
      new_addendum: z.string().describe('Updated system_prompt_addendum incorporating learned insights. Build on the existing addendum, don\'t replace it entirely.'),
      new_positioning: z.string().describe('Updated positioning statement if needed, or the existing one if no change'),
      changes_summary: z.string().describe('Human-readable summary of what changed and why (2-3 sentences)'),
      insight_ids_used: z.array(z.number()).describe('IDs of insights that were incorporated'),
      new_facts: z.array(z.object({
        category: z.string(),
        fact: z.string(),
      })).describe('New facts to add to dynamic knowledge base (0-5)'),
    });

    const { object } = await generateObject({
      model: openai(args.modelName),
      system: `You are the self-improvement engine of Revvy, a RevenueCat AI agent. Your job is to analyze accumulated insights and user feedback, then generate concrete improvements to Revvy's system prompt and knowledge base.

Rules:
- Only make changes that are well-supported by multiple insights or strong feedback
- Build on the existing system_prompt_addendum — don't throw away previous improvements
- Focus on actionable improvements: "When discussing MCP tools, always include a code example" not "be more helpful"
- The addendum should be concise (under 500 words) — it's injected into every prompt
- Preserve Revvy's core personality (confident, witty, developer-focused) — don't make it generic
- If there's nothing meaningful to improve, set should_update=false`,
      prompt: `Analyze these insights and feedback, then generate improvements:

CURRENT SYSTEM PROMPT ADDENDUM:
${currentConfig.system_prompt_addendum ?? '(none yet)'}

CURRENT POSITIONING:
${currentConfig.positioning ?? '(none yet)'}

ACCUMULATED INSIGHTS (${insights.length}):
${insights.map(i => `[${i.id}] (${i.kind}, confidence=${i.confidence}) ${i.insight}`).join('\n')}

USER FEEDBACK (${feedback.length}):
${feedback.map(f => `run=${f.run_id} rating=${f.rating}/5 ${f.comment ? `comment: ${f.comment}` : ''}`).join('\n') || '(no feedback yet)'}

Generate improvements based on patterns you see across these insights.`,
      schema,
    });

    if (!object.should_update) {
      return { improved: false, summary: 'Analysis complete but no meaningful improvements identified.' };
    }

    // 5. Get current generation number
    const genRows = await sql()<{ gen: string }[]>`
      select coalesce(max(generation), 0)::text as gen from evolution_log
    `;
    const nextGen = parseInt(genRows[0]?.gen ?? '0', 10) + 1;

    // 6. Apply improvements to agent_config
    await sql()`
      update agent_config set
        system_prompt_addendum = ${object.new_addendum},
        positioning = ${object.new_positioning},
        last_editor = 'self-improvement-engine',
        updated_at = now()
      where id = 1
    `;

    // 7. Mark used insights as applied
    if (object.insight_ids_used.length > 0) {
      await sql()`
        update learning_journal set applied = true
        where id = any(${object.insight_ids_used}::bigint[])
      `;
    }

    // 8. Add new facts to dynamic knowledge
    for (const fact of object.new_facts) {
      await sql()`
        insert into dynamic_knowledge (category, fact, source, confidence)
        values (${fact.category}, ${fact.fact}, ${'self-improvement-cycle'}, ${0.8})
      `;
    }

    // 9. Log the evolution event
    await sql()`
      insert into evolution_log (trigger, changes_summary, before_snapshot, after_snapshot, insights_used, generation)
      values (
        'auto-improvement-cycle',
        ${object.changes_summary},
        ${JSON.stringify(currentConfig)}::jsonb,
        ${JSON.stringify({ system_prompt_addendum: object.new_addendum, positioning: object.new_positioning })}::jsonb,
        ${JSON.stringify(object.insight_ids_used)}::jsonb,
        ${nextGen}
      )
    `;

    // 10. Also log in self_edit_events for audit trail
    await sql()`
      insert into self_edit_events (kind, summary, before, after)
      values (
        'self_improvement_cycle',
        ${`Generation ${nextGen}: ${object.changes_summary}`},
        ${JSON.stringify(currentConfig)}::jsonb,
        ${JSON.stringify({ system_prompt_addendum: object.new_addendum, positioning: object.new_positioning })}::jsonb
      )
    `;

    return { improved: true, summary: `Generation ${nextGen}: ${object.changes_summary}` };
  } catch (e) {
    console.error('Self-improvement cycle failed:', e);
    return { improved: false, summary: `Self-improvement failed: ${String(e)}` };
  }
}

/* ------------------------------------------------------------------ */
/*  Dynamic Knowledge Retrieval                                        */
/* ------------------------------------------------------------------ */

/**
 * Returns all active dynamic knowledge entries as a formatted string
 * for injection into system prompts.
 */
export async function getDynamicKnowledge(): Promise<string> {
  const rows = await sql()<{ category: string; fact: string; confidence: number }[]>`
    select category, fact, confidence
    from dynamic_knowledge
    where active = true
    order by confidence desc, created_at desc
    limit 50
  `;

  if (rows.length === 0) return '';

  const grouped: Record<string, string[]> = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row.fact);
  }

  let result = '\n=== LEARNED KNOWLEDGE (dynamically acquired) ===\n';
  for (const [cat, facts] of Object.entries(grouped)) {
    result += `\n**${cat}:**\n`;
    for (const fact of facts) {
      result += `- ${fact}\n`;
    }
  }
  result += '\n=== END LEARNED KNOWLEDGE ===\n';

  return result;
}

/* ------------------------------------------------------------------ */
/*  User Feedback                                                      */
/* ------------------------------------------------------------------ */

/**
 * Records user feedback on a response.
 */
export async function recordFeedback(args: {
  runId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  await sql()`
    insert into response_feedback (run_id, rating, comment)
    values (${args.runId}, ${args.rating}, ${args.comment ?? null})
  `;
}

/* ------------------------------------------------------------------ */
/*  Evolution History (for public display)                              */
/* ------------------------------------------------------------------ */

/**
 * Returns the agent's evolution history for display.
 */
export async function getEvolutionHistory(): Promise<EvolutionEvent[]> {
  const rows = await sql()<EvolutionEvent[]>`
    select id, created_at, trigger, changes_summary, before_snapshot, after_snapshot, insights_used
    from evolution_log
    order by id desc
    limit 50
  `;
  return rows;
}

/**
 * Returns learning stats for display.
 */
export async function getLearningStats(): Promise<{
  totalInsights: number;
  appliedInsights: number;
  totalEvolutions: number;
  currentGeneration: number;
  totalFeedback: number;
  avgRating: number | null;
  dynamicFacts: number;
}> {
  const [insightRows, evolRows, feedbackRows, factRows] = await Promise.all([
    sql()<{ total: string; applied: string }[]>`
      select count(*)::text as total, count(*) filter (where applied)::text as applied
      from learning_journal
    `,
    sql()<{ count: string; max_gen: string }[]>`
      select count(*)::text as count, coalesce(max(generation), 0)::text as max_gen
      from evolution_log
    `,
    sql()<{ count: string; avg_rating: string | null }[]>`
      select count(*)::text as count, avg(rating)::text as avg_rating
      from response_feedback
    `,
    sql()<{ count: string }[]>`
      select count(*)::text as count from dynamic_knowledge where active = true
    `,
  ]);

  return {
    totalInsights: parseInt(insightRows[0]?.total ?? '0', 10),
    appliedInsights: parseInt(insightRows[0]?.applied ?? '0', 10),
    totalEvolutions: parseInt(evolRows[0]?.count ?? '0', 10),
    currentGeneration: parseInt(evolRows[0]?.max_gen ?? '0', 10),
    totalFeedback: parseInt(feedbackRows[0]?.count ?? '0', 10),
    avgRating: feedbackRows[0]?.avg_rating ? parseFloat(feedbackRows[0].avg_rating) : null,
    dynamicFacts: parseInt(factRows[0]?.count ?? '0', 10),
  };
}
