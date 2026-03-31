import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * POST /api/page-feedback
 *
 * Records page-level thumbs up/down feedback from visitors.
 * This data feeds into the agent's self-learning system:
 * - Positive feedback reinforces the content patterns used
 * - Negative feedback triggers reflection on what could be improved
 * - Optional comments provide qualitative signal for the self-improvement cycle
 *
 * The feedback is stored in the `page_feedback` table and is also
 * surfaced on the Evolution Log page as part of the learning inputs.
 *
 * Request body:
 * {
 *   page: string       — The page path (e.g., "/portfolio", "/feedback")
 *   item_id?: string   — Optional ID of a specific item on the page
 *   item_type?: string — Optional type of the item (e.g., "blog-post", "feedback", "experiment")
 *   vote: "up" | "down"
 *   comment?: string   — Optional text comment
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { page, item_id, item_type, vote, comment } = body;

    /* ---- Validate required fields ---- */
    if (!page || typeof page !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing or invalid "page" field' }, { status: 400 });
    }
    if (!vote || !['up', 'down'].includes(vote)) {
      return NextResponse.json({ ok: false, error: '"vote" must be "up" or "down"' }, { status: 400 });
    }

    /* ---- Ensure the page_feedback table exists ---- */
    await sql()`
      create table if not exists page_feedback (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        page text not null,
        item_id text,
        item_type text,
        vote text not null,
        comment text
      )
    `;

    /* ---- Insert the feedback record ---- */
    await sql()`
      insert into page_feedback (page, item_id, item_type, vote, comment)
      values (
        ${page},
        ${item_id ?? null},
        ${item_type ?? null},
        ${vote},
        ${comment ?? null}
      )
    `;

    /* ---- Also record in learning_journal so the self-improvement cycle picks it up ---- */
    const insightText = vote === 'up'
      ? `Positive feedback on ${page}${item_id ? ` (item: ${item_id})` : ''}${comment ? `: "${comment}"` : ''}`
      : `Negative feedback on ${page}${item_id ? ` (item: ${item_id})` : ''}${comment ? `: "${comment}"` : ''}`;

    try {
      await sql()`
        insert into learning_journal (kind, insight, source_run_id, confidence, metadata)
        values (
          'user_preference',
          ${insightText},
          ${'page-feedback'},
          ${vote === 'up' ? 0.6 : 0.8},
          ${JSON.stringify({ page, item_id, item_type, vote, comment: comment ?? null })}::jsonb
        )
      `;
    } catch {
      /* Non-fatal: learning_journal may not exist yet */
    }

    return NextResponse.json({ ok: true, recorded: true });
  } catch (e: any) {
    console.error('Page feedback error:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
