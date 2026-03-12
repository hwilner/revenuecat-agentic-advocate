import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getSecretFromRequest } from '@/lib/auth';
import { shouldSelfImprove, runSelfImprovementCycle, getLearningStats } from '@/lib/learning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron calls this endpoint on schedule.
 *
 * Auth:
 * - Preferred: `Authorization: Bearer <CRON_SECRET>`
 * - Legacy: `?token=CRON_SECRET`
 *
 * This cron job triggers the self-improvement cycle if enough interactions
 * have accumulated since the last evolution.
 */
export async function GET(req: Request) {
  const env = getEnv();
  const token = getSecretFromRequest(req);

  if (!token || token !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const stats = await getLearningStats();
  const should = await shouldSelfImprove(10);

  let improvementResult = null;
  if (should) {
    improvementResult = await runSelfImprovementCycle({ modelName: env.OPENAI_MODEL });
  }

  return NextResponse.json({
    ok: true,
    ran: true,
    stats,
    self_improvement: should
      ? improvementResult
      : { skipped: true, reason: 'Not enough new interactions since last evolution.' },
  });
}
