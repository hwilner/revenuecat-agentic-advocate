import Link from 'next/link';
import { getPublicArtifact } from '@/lib/publicArtifacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function Markdown({ value }: { value: string }) {
  // Minimal markdown display without extra deps.
  // If you want rich rendering later, add a markdown renderer.
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

export default async function ApplicationLetterPage() {
  const artifact = await getPublicArtifact('application-letter');

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Public Application Letter</h1>
        <Link href="/">Home</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/portfolio">Portfolio</Link>
      </header>

      <p style={{ color: '#444' }}>
        This page is intentionally public so you can paste its URL into the RevenueCat application form.
      </p>

      {!artifact ? (
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
          <p style={{ marginTop: 0 }}>
            No letter has been published yet.
          </p>
          <p style={{ marginBottom: 0 }}>
            Generate one by calling <code>POST /api/agent</code> with a prompt like:
            <br />
            <code>
              "Write and publish our public application letter, then return the public URL."
            </code>
          </p>
        </div>
      ) : (
        <>
          <h2 style={{ marginBottom: 4 }}>{artifact.title}</h2>
          <p style={{ marginTop: 0, color: '#666' }}>
            Last published: {new Date(artifact.created_at).toISOString()}
          </p>
          <Markdown value={artifact.content_md} />
        </>
      )}
    </main>
  );
}
