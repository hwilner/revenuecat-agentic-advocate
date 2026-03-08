import Link from 'next/link';
import { listPublicArtifacts } from '@/lib/publicArtifacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const items = await listPublicArtifacts(50);

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Agent Portfolio</h1>
        <Link href="/">Home</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/application-letter">Application Letter</Link>
      </header>

      <p style={{ color: '#444' }}>
        This page lists public artifacts the agent has published (application letter, portfolio snapshots, etc.).
      </p>

      {items.length === 0 ? (
        <div style={{ padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
          No public artifacts yet.
        </div>
      ) : (
        <ul style={{ lineHeight: 1.6 }}>
          {items.map((i) => (
            <li key={i.slug}>
              <strong>{i.kind}</strong>: {i.title}{' '}
              <span style={{ color: '#666' }}>
                ({new Date(i.created_at).toISOString()})
              </span>
              {' — '}
              {i.slug === 'application-letter' ? (
                <Link href="/application-letter">view</Link>
              ) : (
                <Link href={`/p/${i.slug}`}>view</Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Suggested links for the application form</h2>
        <ul>
          <li>
            Application letter: <code>/application-letter</code>
          </li>
          <li>
            Portfolio: <code>/portfolio</code>
          </li>
        </ul>
      </section>
    </main>
  );
}
