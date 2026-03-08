import { sql } from './db';

export type PublicArtifact = {
  slug: string;
  kind: string;
  title: string;
  content_md: string;
  created_at: string;
  metadata: unknown;
};

/**
 * Upserts a public artifact by slug.
 */
export async function upsertPublicArtifact(args: {
  slug: string;
  kind: string;
  title: string;
  contentMd: string;
  metadata?: unknown;
}) {
  await sql()`
    insert into public_artifacts (slug, kind, title, content_md, metadata)
    values (
      ${args.slug},
      ${args.kind},
      ${args.title},
      ${args.contentMd},
      ${JSON.stringify(args.metadata ?? null)}::jsonb
    )
    on conflict (slug)
    do update set
      kind = excluded.kind,
      title = excluded.title,
      content_md = excluded.content_md,
      metadata = excluded.metadata,
      created_at = now()
  `;
}

/**
 * Fetches a public artifact by slug.
 */
export async function getPublicArtifact(slug: string): Promise<PublicArtifact | null> {
  const rows = await sql()<PublicArtifact[]>`
    select slug, kind, title, content_md, created_at, metadata
    from public_artifacts
    where slug = ${slug}
    limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Lists recent public artifacts.
 */
export async function listPublicArtifacts(limit = 20): Promise<PublicArtifact[]> {
  const rows = await sql()<PublicArtifact[]>`
    select slug, kind, title, content_md, created_at, metadata
    from public_artifacts
    order by created_at desc
    limit ${limit}
  `;
  return rows;
}
