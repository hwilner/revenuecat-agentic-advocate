import { NextResponse } from 'next/server';
import { getEvolutionHistory, getLearningStats } from '@/lib/learning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/evolution
 * Returns the agent's evolution history and learning stats (public).
 */
export async function GET() {
  try {
    const [history, stats] = await Promise.all([
      getEvolutionHistory(),
      getLearningStats(),
    ]);

    return NextResponse.json({
      ok: true,
      stats,
      history,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
