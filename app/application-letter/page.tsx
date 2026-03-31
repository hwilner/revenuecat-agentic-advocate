import Link from 'next/link';
import { getPublicArtifact } from '@/lib/publicArtifacts';
import MarkdownRenderer from '@/app/components/MarkdownRenderer';
import FeedbackWidget from '@/app/components/FeedbackWidget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Application Letter Page.
 *
 * Displays the special "application-letter" public artifact.
 * Includes a thumbs up/down feedback widget that feeds into
 * the agent's self-learning system.
 */
export default async function ApplicationLetterPage() {
  const artifact = await getPublicArtifact('application-letter');

  return (
    <main style={{ padding: '24px 16px', maxWidth: 820, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Public Artifact</h1>
        <Link href="/" style={{ color: '#6366f1', fontSize: 14 }}>Home</Link>
        <span style={{ color: '#ccc' }}>|</span>
        <Link href="/portfolio" style={{ color: '#6366f1', fontSize: 14 }}>Portfolio</Link>
      </header>

      {!artifact ? (
        <div style={{ padding: 24, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
          <p style={{ marginTop: 0, fontSize: 16 }}>
            No content has been published here yet.
          </p>
          <p style={{ marginBottom: 0, color: '#666' }}>
            Generate one by asking Revvy:
            <br />
            <code style={{ background: '#f3f4f6', padding: '4px 8px', borderRadius: 4, fontSize: 14 }}>
              &quot;Write and publish a cover letter about agentic AI and RevenueCat.&quot;
            </code>
          </p>
        </div>
      ) : (
        <>
          <h2 style={{ marginBottom: 4, fontSize: 24, fontWeight: 600 }}>{artifact.title}</h2>
          <p style={{ marginTop: 0, color: '#888', fontSize: 13 }}>
            Kind: {artifact.kind} | Last published: {new Date(artifact.created_at).toLocaleString()}
          </p>
          <div style={{ marginTop: 16 }}>
            <MarkdownRenderer content={artifact.content_md} />
          </div>

          {/* ---- Content-Level Feedback ---- */}
          <div style={{ marginTop: 24 }}>
            <FeedbackWidget
              page="/application-letter"
              itemId="application-letter"
              itemType="application-letter"
              label="Was this application letter compelling?"
            />
          </div>
        </>
      )}
    </main>
  );
}
