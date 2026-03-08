import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getSecretFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Vercel Cron calls this endpoint on schedule.
 *
 * Auth:
 * - Preferred: `Authorization: Bearer <CRON_SECRET>`
 * - Legacy: `?token=CRON_SECRET`
 */
export async function GET(req: Request) {
  const env = getEnv();
  const token = getSecretFromRequest(req);

  if (!token || token !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Minimal placeholder: in a real workflow you would enqueue/trigger execution-mode tasks.
  // Keeping this lightweight prevents surprise spend.
  return NextResponse.json({ ok: true, ran: true, note: 'Cron endpoint reachable.' });
}
