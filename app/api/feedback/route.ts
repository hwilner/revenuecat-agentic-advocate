import { NextResponse } from 'next/server';
import { recordFeedback } from '@/lib/learning';

export const runtime = 'nodejs';

/**
 * POST /api/feedback
 * Body: { run_id: string, rating: number (1-5), comment?: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.run_id || typeof body.rating !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'Missing run_id or rating' },
        { status: 400 },
      );
    }

    const rating = Math.max(1, Math.min(5, Math.round(body.rating)));

    await recordFeedback({
      runId: String(body.run_id),
      rating,
      comment: body.comment ? String(body.comment) : undefined,
    });

    return NextResponse.json({ ok: true, recorded: { run_id: body.run_id, rating } });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
