import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { getSecretFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One-time DB initialization endpoint.
 *
 * GET /api/admin/init
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

  await initDb();
  return NextResponse.json({ ok: true });
}
