import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';
import { getSecretFromRequest } from '@/lib/auth';
import { shouldSelfImprove, runSelfImprovementCycle, getLearningStats } from '@/lib/learning';
import { processDueScheduledItems, getKPISummary } from '@/lib/scheduler';
import { getWeeklySocialStats } from '@/lib/twitter';

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

  // Process any scheduled content that is due
  let schedulingResult = null;
  try {
    schedulingResult = await processDueScheduledItems();
  } catch (e) {
    console.error('Scheduled content processing failed (non-fatal):', e);
    schedulingResult = { error: String(e) };
  }

  // Gather KPI summary
  let kpis = null;
  try {
    const [kpiData, socialData] = await Promise.all([
      getKPISummary(),
      getWeeklySocialStats(),
    ]);
    kpis = { ...kpiData, social: socialData };
  } catch (e) {
    console.error('KPI gathering failed (non-fatal):', e);
  }

  return NextResponse.json({
    ok: true,
    ran: true,
    stats,
    self_improvement: should
      ? improvementResult
      : { skipped: true, reason: 'Not enough new interactions since last evolution.' },
    scheduled_content: schedulingResult,
    kpis,
  });
}
