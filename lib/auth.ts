/**
 * Extracts a bearer token from an Authorization header.
 *
 * Expected format: `Authorization: Bearer <token>`
 */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/**
 * Backwards-compatible secret extraction.
 *
 * Preferred: Authorization header.
 * Legacy: `?token=` query param.
 */
export function getSecretFromRequest(req: Request): string | null {
  const bearer = getBearerToken(req);
  if (bearer) return bearer;

  const { searchParams } = new URL(req.url);
  return searchParams.get('token');
}
