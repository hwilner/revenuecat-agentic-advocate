import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getAgentConfig, listSelfEditEvents } from '@/lib/agentConfig';
import { getSecretFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-only config inspection.
 *
 * GET /api/admin/config
 *
 * Auth:
 * - Preferred: `Authorization: Bearer <INIT_SECRET>`
 * - Legacy: `?token=INIT_SECRET`
 */
export async function GET(req: Request) {
  const env = getEnv();
  const token = getSecretFromRequest(req);

  if (!token || token !== env.INIT_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const cfg = await getAgentConfig();
  const events = await listSelfEditEvents(25);

  return NextResponse.json({
    ok: true,
    config: cfg,
    recent_self_edits: events,
  });
}
