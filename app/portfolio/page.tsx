import Link from 'next/link';
import { listPublicArtifacts, type PublicArtifact } from '@/lib/publicArtifacts';
import FeedbackWidget from '@/app/components/FeedbackWidget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Portfolio Archive Page.
 *
 * Displays all published content artifacts from the database, organized by
 * category (kind). Users can filter by content type using the category tabs.
 * This page serves as the proof-of-abilities archive for Revvy's content output.
 */
export default async function PortfolioPage() {
  const items = await listPublicArtifacts(100);

  /* ------------------------------------------------------------------ */
  /*  Group items by kind for category display                           */
  /* ------------------------------------------------------------------ */
  const categories = new Map<string, PublicArtifact[]>();
  for (const item of items) {
    const kind = item.kind || 'other';
    if (!categories.has(kind)) categories.set(kind, []);
    categories.get(kind)!.push(item);
  }

  const categoryList = Array.from(categories.keys()).sort();

  return (
    <main style={{ padding: '24px 16px', maxWidth: 980, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ---- Header ---- */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Agent Portfolio</h1>
        <nav style={{ display: 'flex', gap: 8, fontSize: 14 }}>
          <Link href="/" style={{ color: '#6366f1' }}>Home</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/application-letter" style={{ color: '#6366f1' }}>Application Letter</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/feedback" style={{ color: '#6366f1' }}>Product Feedback</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/campaigns" style={{ color: '#6366f1' }}>Growth Campaigns</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/evolution" style={{ color: '#6366f1' }}>Evolution Log</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/health" style={{ color: '#6366f1' }}>Health Dashboard</Link>
        </nav>
      </header>

      <p style={{ color: '#555', lineHeight: 1.5, marginTop: 12 }}>
        All content published by Revvy — blog posts, tutorials, application letters, code samples, and more.
        This archive is populated from the database and updates automatically as new content is created.
      </p>

      {/* ---- Summary Stats ---- */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard label="Total Pieces" value={String(items.length)} color="#6366f1" />
        {categoryList.map((cat) => (
          <StatCard
            key={cat}
            label={formatKind(cat)}
            value={String(categories.get(cat)!.length)}
            color="#10b981"
          />
        ))}
      </div>

      {/* ---- Content by Category ---- */}
      {items.length === 0 ? (
        <div style={{ padding: 24, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#888' }}>
            No published artifacts yet. Ask Revvy to write and publish something!
          </p>
        </div>
      ) : (
        categoryList.map((cat) => (
          <section key={cat} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 16 }}>
              {formatKind(cat)}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {categories.get(cat)!.map((item) => (
                <ContentCard key={item.slug} item={item} />
              ))}
            </div>
          </section>
        ))
      )}

      {/* ---- Page Feedback ---- */}
      <FeedbackWidget page="/portfolio" label="Is this portfolio helpful?" />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper Components                                                  */
/* ------------------------------------------------------------------ */

/**
 * Displays a single content artifact as a card with title, date, and preview.
 */
function ContentCard({ item }: { item: PublicArtifact }) {
  const date = new Date(item.created_at);
  const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const preview = (item.content_md || '').replace(/[#*`\[\]]/g, '').slice(0, 200).trim();
  const href = item.slug === 'application-letter' ? '/application-letter' : `/p/${item.slug}`;

  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          padding: 16,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          background: '#fafafa',
          transition: 'border-color 0.15s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1a1a2e' }}>
            {item.title}
          </h3>
          <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap', marginLeft: 12 }}>
            {dateStr}
          </span>
        </div>
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 600,
            color: '#6366f1',
            background: '#eef2ff',
            padding: '2px 8px',
            borderRadius: 4,
            marginBottom: 8,
          }}
        >
          {formatKind(item.kind)}
        </span>
        {preview && (
          <p style={{ margin: 0, fontSize: 14, color: '#666', lineHeight: 1.5 }}>
            {preview}...
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * Displays a numeric stat in a compact card format.
 */
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#f9fafb',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/**
 * Converts a slug-style kind string to a human-readable title.
 * For example, "blog-post" becomes "Blog Posts".
 */
function formatKind(kind: string): string {
  const map: Record<string, string> = {
    'blog-post': 'Blog Posts',
    'application-letter': 'Application Letters',
    'tutorial': 'Tutorials',
    'code-sample': 'Code Samples',
    'case-study': 'Case Studies',
    'documentation-update': 'Documentation Updates',
    'portfolio': 'Portfolio Pieces',
    'tweet': 'Tweets',
    'other': 'Other',
  };
  return map[kind] || kind.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + 's';
}
