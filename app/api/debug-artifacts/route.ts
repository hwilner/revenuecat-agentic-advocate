import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const env = getEnv();
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${env.INIT_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await sql()<any[]>`
    select slug, kind, title, length(content_md) as content_length, 
           left(content_md, 200) as content_preview,
           created_at
    from public_artifacts
    order by created_at desc
    limit 10
  `;

  return NextResponse.json({ artifacts: rows });
}
