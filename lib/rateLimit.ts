import crypto from 'crypto';
import { sql } from './db';
import { getEnv } from './env';

function utcMinuteKey(d = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function utcDayKey(d = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/**
 * Basic DB-backed per-IP, per-minute rate limit.
 *
 * - Enabled when RATE_LIMIT_PER_IP_PER_MINUTE > 0
 * - Uses `usage_counters` so it survives serverless cold starts
 */
export async function checkRateLimit(ip: string): Promise<
  | { enabled: false }
  | { enabled: true; limited: boolean; count: number; limit: number; bucket: string }
> {
  const env = getEnv();
  const limit = env.RATE_LIMIT_PER_IP_PER_MINUTE;
  if (!limit || limit <= 0) return { enabled: false };

  const day = utcDayKey();
  const bucket = utcMinuteKey();
  const ipHash = hashIp(ip || 'unknown');
  const counterKey = `rl:${bucket}:${ipHash}`;

  const rows = await sql()<
    {
      counter_value: number;
    }[]
  >`
    insert into usage_counters (day, counter_key, counter_value)
    values (${day}, ${counterKey}, 1)
    on conflict (day, counter_key)
    do update set counter_value = usage_counters.counter_value + 1
    returning counter_value
  `;

  const count = rows[0]?.counter_value ?? 1;
  return { enabled: true, limited: count > limit, count, limit, bucket };
}

/**
 * Best-effort client IP extraction for Vercel.
 */
export function getClientIp(req: Request): string {
  const xf = req.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() ?? 'unknown';
  return req.headers.get('x-real-ip') ?? 'unknown';
}
