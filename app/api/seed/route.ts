import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';

/**
 * GET /api/seed
 *
 * Triggers the database initialization and sample data seeding.
 * This endpoint is idempotent — calling it multiple times will not
 * create duplicate data because the seed function checks if tables
 * are already populated before inserting.
 *
 * This route exists because the seed function was added after the
 * initial database tables were already created. On Vercel, initDb()
 * only runs on cold starts, so this route provides a way to manually
 * trigger the seed on an already-initialized database.
 */
export async function GET() {
  try {
    await initDb();
    return NextResponse.json({ ok: true, message: 'Database initialized and sample data seeded.' });
  } catch (e: any) {
    console.error('Seed error:', e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
