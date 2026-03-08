import Link from 'next/link';
import { getPublicArtifact } from '@/lib/publicArtifacts';

export const runtime = 'nodejs';

function Markdown({ value }: { value: string }) {
  return (
    <pre
      style={{
        whiteSpace: 'pre-wrap',
        lineHeight: 1.45,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        background: '#0b1020',
        color: '#e6e6e6',
        padding: 16,
        borderRadius: 12,
      }}
    >
      {value}
    </pre>
  );
}

export default async function PublicArtifactPage({
  params,
}: {
  params: { slug: string };
}) {
  const artifact = await getPublicArtifact(params.slug);

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Public Artifact</h1>
        <Link href="/">Home</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/portfolio">Portfolio</Link>
      </header>

      {!artifact ? (
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
          Not found.
        </div>
      ) : (
        <>
          <h2 style={{ marginBottom: 4 }}>{artifact.title}</h2>
          <p style={{ marginTop: 0, color: '#666' }}>
            Kind: {artifact.kind} | Last published: {new Date(artifact.created_at).toISOString()}
          </p>
          <Markdown value={artifact.content_md} />
        </>
      )}
    </main>
  );
}
