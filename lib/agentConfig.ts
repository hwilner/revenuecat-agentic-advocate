import { sql } from './db';

export type AgentConfig = {
  agent_name: string | null;
  positioning: string | null;
  system_prompt_addendum: string | null;
  portfolio_links: unknown;
  updated_at: string;
};

/**
 * Loads the current agent configuration (single-row table).
 */
export async function getAgentConfig(): Promise<AgentConfig | null> {
  const rows = await sql()<
    (AgentConfig & { id: number })[]
  >`
    select agent_name, positioning, system_prompt_addendum, portfolio_links, updated_at, id
    from agent_config
    where id = 1
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;
  // Strip id.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...cfg } = row;
  return cfg;
}

/**
 * Updates the agent config and writes an audit event.
 */
export async function updateAgentConfig(args: {
  agent_name?: string;
  positioning?: string;
  system_prompt_addendum?: string;
  portfolio_links?: unknown;
  editor: string;
}) {
  const before = await getAgentConfig();

  await sql()`
    insert into agent_config (id, agent_name, positioning, system_prompt_addendum, portfolio_links, last_editor, constraint_check)
    values (1, ${args.agent_name ?? null}, ${args.positioning ?? null}, ${args.system_prompt_addendum ?? null}, ${JSON.stringify(
      args.portfolio_links ?? null,
    )}::jsonb, ${args.editor}, ${JSON.stringify({
      invariant: 'guardrails-and-token-gating-not-editable',
    })}::jsonb)
    on conflict (id)
    do update set
      updated_at = now(),
      agent_name = coalesce(excluded.agent_name, agent_config.agent_name),
      positioning = coalesce(excluded.positioning, agent_config.positioning),
      system_prompt_addendum = coalesce(excluded.system_prompt_addendum, agent_config.system_prompt_addendum),
      portfolio_links = coalesce(excluded.portfolio_links, agent_config.portfolio_links),
      last_editor = excluded.last_editor,
      constraint_check = excluded.constraint_check
  `;

  const after = await getAgentConfig();

  await sql()`
    insert into self_edit_events (kind, summary, before, after)
    values (
      'agent_config_update',
      ${`Updated agent config by ${args.editor}`},
      ${JSON.stringify(before ?? null)}::jsonb,
      ${JSON.stringify(after ?? null)}::jsonb
    )
  `;

  return after;
}

/**
 * Returns recent self-edit events.
 */
export async function listSelfEditEvents(limit = 50) {
  const rows = await sql()<
    {
      id: number;
      created_at: string;
      kind: string;
      summary: string;
      before: unknown;
      after: unknown;
    }[]
  >`
    select id, created_at, kind, summary, before, after
    from self_edit_events
    order by id desc
    limit ${limit}
  `;

  return rows;
}
