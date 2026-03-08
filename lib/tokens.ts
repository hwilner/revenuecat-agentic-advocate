import crypto from 'crypto';
import { sql } from './db';
import { getEnv } from './env';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Mints a single-use upgrade token and stores its hash.
 */
export async function mintUpgradeToken(args: {
  scope: string;
  note?: string;
}): Promise<{ token: string; expiresAt: Date }>{
  const env = getEnv();
  const token = crypto.randomBytes(24).toString('base64url');
  const tokenHash = sha256Hex(`${env.TOKEN_SIGNING_SECRET}:${token}`);

  const ttlMinutes = Number(env.UPGRADE_TOKEN_TTL_MINUTES || 30);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await sql()`
    insert into upgrade_tokens (token_hash, expires_at, scope, note)
    values (${tokenHash}, ${expiresAt.toISOString()}, ${args.scope}, ${args.note ?? null})
    on conflict (token_hash) do nothing
  `;

  return { token, expiresAt };
}

/**
 * Consumes a single-use upgrade token.
 *
 * Returns true if token is valid and is now marked used.
 */
export async function consumeUpgradeToken(token: string): Promise<boolean> {
  const env = getEnv();
  const tokenHash = sha256Hex(`${env.TOKEN_SIGNING_SECRET}:${token}`);

  const rows = await sql()<
    {
      used_at: string | null;
      expires_at: string;
    }[]
  >`
    select used_at, expires_at
    from upgrade_tokens
    where token_hash = ${tokenHash}
    limit 1
  `;

  if (rows.length === 0) return false;
  const row = rows[0];

  if (row.used_at) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;

  const updated = await sql()`
    update upgrade_tokens
    set used_at = now()
    where token_hash = ${tokenHash}
      and used_at is null
      and expires_at > now()
  `;

  // postgres library returns an array-ish object; easiest: re-check.
  return updated.count === 1;
}
