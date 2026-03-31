import Link from 'next/link';
import { sql } from '@/lib/db';
import FeedbackWidget from '@/app/components/FeedbackWidget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Product Feedback type representing a structured feedback entry.
 * Feedback is stored in the social_actions table with platform='slack'
 * and action='product_feedback', with structured data in the metadata field.
 * It is also stored in the product_feedback_archive table for richer display.
 */
type FeedbackEntry = {
  id: number;
  created_at: string;
  title: string;
  problem: string;
  impact: string;
  proposed_solution: string;
  source: string;
  priority: string;
  status: string;
};

/**
 * Fallback type for feedback stored only in social_actions (before archive table existed).
 */
type SocialActionFeedback = {
  id: number;
  created_at: string;
  content: string;
  metadata: {
    title?: string;
    problem?: string;
    impact?: string;
    proposed_solution?: string;
    proposedSolution?: string;
    source?: string;
    priority?: string;
  } | null;
};

/**
 * Product Feedback Archive Page.
 *
 * Displays all structured product feedback submitted by Revvy to the
 * RevenueCat product team. Feedback is sourced from:
 * 1. The product_feedback_archive table (primary, structured)
 * 2. The social_actions table where action='product_feedback' (fallback)
 *
 * This page serves as proof that the agent can identify, structure, and
 * submit meaningful product feedback based on usage and community observations.
 */
export default async function FeedbackPage() {
  let feedbackItems: FeedbackEntry[] = [];
  let fallbackItems: SocialActionFeedback[] = [];

  try {
    /* ------------------------------------------------------------------ */
    /*  Try the dedicated archive table first                              */
    /* ------------------------------------------------------------------ */
    feedbackItems = await sql()<FeedbackEntry[]>`
      select id, created_at, title, problem, impact, proposed_solution, source, priority, status
      from product_feedback_archive
      order by created_at desc
      limit 50
    `;
  } catch {
    /* Table may not exist yet — that is fine, we fall back to social_actions */
  }

  try {
    /* ------------------------------------------------------------------ */
    /*  Fallback: read from social_actions where action = product_feedback  */
    /* ------------------------------------------------------------------ */
    fallbackItems = await sql()<SocialActionFeedback[]>`
      select id, created_at, content, metadata
      from social_actions
      where platform = 'slack' and action = 'product_feedback'
      order by created_at desc
      limit 50
    `;
  } catch {
    /* social_actions table may not exist yet */
  }

  /* ------------------------------------------------------------------ */
  /*  Merge: prefer archive items, supplement with social_actions         */
  /* ------------------------------------------------------------------ */
  const archiveIds = new Set(feedbackItems.map((f) => f.title));
  const mergedFallback: FeedbackEntry[] = fallbackItems
    .filter((sa) => {
      const title = sa.metadata?.title ?? sa.content.slice(0, 60);
      return !archiveIds.has(title);
    })
    .map((sa) => ({
      id: sa.id + 100000,
      created_at: sa.created_at,
      title: sa.metadata?.title ?? 'Product Feedback',
      problem: sa.metadata?.problem ?? sa.content,
      impact: sa.metadata?.impact ?? '',
      proposed_solution: sa.metadata?.proposed_solution ?? sa.metadata?.proposedSolution ?? '',
      source: sa.metadata?.source ?? 'agent usage',
      priority: sa.metadata?.priority ?? 'medium',
      status: 'submitted',
    }));

  const allFeedback = [...feedbackItems, ...mergedFallback].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  /* ------------------------------------------------------------------ */
  /*  Priority stats                                                     */
  /* ------------------------------------------------------------------ */
  const priorityCounts: Record<string, number> = {};
  for (const f of allFeedback) {
    const p = f.priority || 'medium';
    priorityCounts[p] = (priorityCounts[p] || 0) + 1;
  }

  return (
    <main style={{ padding: '24px 16px', maxWidth: 980, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ---- Header ---- */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Product Feedback Archive</h1>
        <nav style={{ display: 'flex', gap: 8, fontSize: 14 }}>
          <Link href="/" style={{ color: '#6366f1' }}>Home</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/portfolio" style={{ color: '#6366f1' }}>Portfolio</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/campaigns" style={{ color: '#6366f1' }}>Growth Campaigns</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/evolution" style={{ color: '#6366f1' }}>Evolution Log</Link>
        </nav>
      </header>

      <p style={{ color: '#555', lineHeight: 1.5, marginTop: 12 }}>
        Structured product feedback and feature requests submitted by Revvy to the RevenueCat product team,
        based on agent usage and community observations. Each entry follows the Problem → Impact → Proposed Solution format.
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
        <StatCard label="Total Feedback" value={String(allFeedback.length)} color="#6366f1" />
        <StatCard label="Critical" value={String(priorityCounts['critical'] || 0)} color="#ef4444" />
        <StatCard label="High" value={String(priorityCounts['high'] || 0)} color="#f97316" />
        <StatCard label="Medium" value={String(priorityCounts['medium'] || 0)} color="#eab308" />
        <StatCard label="Low" value={String(priorityCounts['low'] || 0)} color="#22c55e" />
      </div>

      {/* ---- Feedback Cards ---- */}
      {allFeedback.length === 0 ? (
        <div style={{ padding: 24, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#888' }}>
            No product feedback submitted yet. Ask Revvy to analyze RevenueCat and submit feedback!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {allFeedback.map((fb) => (
            <div key={fb.id}>
              <FeedbackCard feedback={fb} />
              <FeedbackWidget
                page="/feedback"
                itemId={String(fb.id)}
                itemType="product-feedback"
                label="Is this feedback valuable?"
              />
            </div>
          ))}
        </div>
      )}

      {/* ---- Page-Level Feedback ---- */}
      <div style={{ marginTop: 24 }}>
        <FeedbackWidget page="/feedback" label="Is this feedback archive useful?" />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper Components                                                  */
/* ------------------------------------------------------------------ */

/**
 * Renders a single feedback entry as a structured card.
 */
function FeedbackCard({ feedback }: { feedback: FeedbackEntry }) {
  const date = new Date(feedback.created_at);
  const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const priorityColors: Record<string, { bg: string; text: string }> = {
    critical: { bg: '#fef2f2', text: '#ef4444' },
    high: { bg: '#fff7ed', text: '#f97316' },
    medium: { bg: '#fefce8', text: '#ca8a04' },
    low: { bg: '#f0fdf4', text: '#22c55e' },
  };
  const pColor = priorityColors[feedback.priority] || priorityColors['medium'];

  return (
    <div
      style={{
        padding: 20,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fafafa',
        borderLeft: `4px solid ${pColor.text}`,
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1a1a2e' }}>
          {feedback.title}
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: pColor.text,
              background: pColor.bg,
              padding: '3px 10px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}
          >
            {feedback.priority}
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>{dateStr}</span>
        </div>
      </div>

      {/* Problem */}
      {feedback.problem && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Problem
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
            {feedback.problem}
          </p>
        </div>
      )}

      {/* Impact */}
      {feedback.impact && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Impact
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
            {feedback.impact}
          </p>
        </div>
      )}

      {/* Proposed Solution */}
      {feedback.proposed_solution && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Proposed Solution
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
            {feedback.proposed_solution}
          </p>
        </div>
      )}

      {/* Source */}
      {feedback.source && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
          Source: {feedback.source}
        </div>
      )}
    </div>
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
