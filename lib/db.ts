import postgres from 'postgres';
import { getEnv } from './env';
import { initLearningTables } from './learning';

let _sql: ReturnType<typeof postgres> | null = null;

/**
 * Returns a singleton Postgres client.
 *
 * Vercel Functions can reuse the same instance across invocations.
 */
export function sql() {
  if (_sql) return _sql;
  const env = getEnv();
  _sql = postgres(env.DATABASE_URL, {
    // Recommended defaults for serverless.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 20,
  });
  return _sql;
}

/**
 * Creates DB tables if they do not already exist.
 */
export async function initDb() {
  const db = sql();

  // A simple run store for interview evidence.
  await db`
    create table if not exists agent_runs (
      id text primary key,
      created_at timestamptz not null default now(),
      mode text not null,
      prompt text not null,
      response text not null,
      routing jsonb,
      artifacts jsonb,
      evidence jsonb,
      evaluator jsonb,
      error text
    );
  `;

  // One-time upgrade tokens (single use).
  await db`
    create table if not exists upgrade_tokens (
      token_hash text primary key,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      used_at timestamptz,
      scope text not null,
      note text
    );
  `;

  // Daily usage counters (UTC day string).
  await db`
    create table if not exists usage_counters (
      day text not null,
      counter_key text not null,
      counter_value integer not null default 0,
      primary key (day, counter_key)
    );
  `;

  // Public-facing pages/artifacts (application letter, portfolio snapshots, etc.).
  await db`
    create table if not exists public_artifacts (
      slug text primary key,
      created_at timestamptz not null default now(),
      kind text not null,
      title text not null,
      content_md text not null,
      metadata jsonb
    );
  `;

  // Agent runtime config (self-editable prompt addendum + public identity).
  await db`
    create table if not exists agent_config (
      id integer primary key default 1,
      updated_at timestamptz not null default now(),
      agent_name text,
      positioning text,
      system_prompt_addendum text,
      portfolio_links jsonb,
      last_editor text,
      constraint_check jsonb
    );
  `;

  // Audit log for self-edits (prompt changes, portfolio updates, etc.).
  await db`
    create table if not exists self_edit_events (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      kind text not null,
      summary text not null,
      before jsonb,
      after jsonb
    );
  `;

  // Learning & evolution tables.
  await initLearningTables();
}
