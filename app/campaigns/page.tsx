import Link from 'next/link';
import { sql } from '@/lib/db';
import FeedbackWidget from '@/app/components/FeedbackWidget';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Growth Experiment type representing a structured campaign entry.
 * Stored in the growth_experiments table.
 */
type GrowthExperiment = {
  id: number;
  created_at: string;
  title: string;
  hypothesis: string;
  experiment_type: string;
  status: string;
  platforms: string;
  description: string;
  results: string | null;
  metrics: Record<string, unknown> | null;
  completed_at: string | null;
};

/**
 * Social action summary for campaign activity display.
 */
type PlatformSummary = {
  platform: string;
  action: string;
  count: number;
};

/**
 * Growth Campaigns Showcase Page.
 *
 * Displays all growth experiments run by Revvy, including:
 * - Social media campaigns (Twitter threads, engagement drives)
 * - Programmatic SEO projects
 * - Content format experiments
 * - Community engagement initiatives
 *
 * Data is sourced from:
 * 1. The growth_experiments table (primary, structured)
 * 2. The social_actions table for activity metrics
 * 3. The content_schedule table for scheduled campaign content
 *
 * This page serves as proof that the agent can design, execute, and
 * track growth experiments aimed at driving awareness and user acquisition.
 */
export default async function CampaignsPage() {
  let experiments: GrowthExperiment[] = [];
  let platformSummary: PlatformSummary[] = [];
  let totalSocialActions = 0;
  let scheduledContent = 0;

  try {
    /* ------------------------------------------------------------------ */
    /*  Load growth experiments from the dedicated table                    */
    /* ------------------------------------------------------------------ */
    experiments = await sql()<GrowthExperiment[]>`
      select id, created_at, title, hypothesis, experiment_type, status, platforms, description, results, metrics, completed_at
      from growth_experiments
      order by created_at desc
      limit 50
    `;
  } catch {
    /* Table may not exist yet — that is fine */
  }

  try {
    /* ------------------------------------------------------------------ */
    /*  Load social action summary for activity metrics                    */
    /* ------------------------------------------------------------------ */
    platformSummary = await sql()<PlatformSummary[]>`
      select platform, action, count(*)::int as count
      from social_actions
      group by platform, action
      order by count desc
      limit 20
    `;

    const totalRows = await sql()<{ count: string }[]>`
      select count(*)::text as count from social_actions
    `;
    totalSocialActions = parseInt(totalRows[0]?.count ?? '0', 10);
  } catch {
    /* social_actions table may not exist yet */
  }

  try {
    /* ------------------------------------------------------------------ */
    /*  Count scheduled content items                                      */
    /* ------------------------------------------------------------------ */
    const schedRows = await sql()<{ count: string }[]>`
      select count(*)::text as count from content_schedule
    `;
    scheduledContent = parseInt(schedRows[0]?.count ?? '0', 10);
  } catch {
    /* content_schedule table may not exist yet */
  }

  /* ------------------------------------------------------------------ */
  /*  Experiment status counts                                           */
  /* ------------------------------------------------------------------ */
  const statusCounts: Record<string, number> = {};
  for (const exp of experiments) {
    const s = exp.status || 'planned';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  return (
    <main style={{ padding: '24px 16px', maxWidth: 980, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ---- Header ---- */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Growth Campaigns</h1>
        <nav style={{ display: 'flex', gap: 8, fontSize: 14 }}>
          <Link href="/" style={{ color: '#6366f1' }}>Home</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/portfolio" style={{ color: '#6366f1' }}>Portfolio</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/feedback" style={{ color: '#6366f1' }}>Product Feedback</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/evolution" style={{ color: '#6366f1' }}>Evolution Log</Link>
        </nav>
      </header>

      <p style={{ color: '#555', lineHeight: 1.5, marginTop: 12 }}>
        Growth experiments and campaigns executed by Revvy — social media campaigns, programmatic SEO projects,
        content format experiments, and community engagement initiatives. Each experiment follows the
        Hypothesis → Execution → Results framework.
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
        <StatCard label="Experiments" value={String(experiments.length)} color="#6366f1" />
        <StatCard label="Social Actions" value={String(totalSocialActions)} color="#10b981" />
        <StatCard label="Scheduled Content" value={String(scheduledContent)} color="#f59e0b" />
        <StatCard label="Active" value={String(statusCounts['active'] || statusCounts['running'] || 0)} color="#3b82f6" />
        <StatCard label="Completed" value={String(statusCounts['completed'] || 0)} color="#22c55e" />
      </div>

      {/* ---- Platform Activity Breakdown ---- */}
      {platformSummary.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 16 }}>
            Platform Activity
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {platformSummary.map((ps, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  background: '#f9fafb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    {formatPlatform(ps.platform)}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {formatAction(ps.action)}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#6366f1' }}>
                  {ps.count}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Experiments ---- */}
      <section>
        <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 16 }}>
          Experiments
        </h2>

        {experiments.length === 0 ? (
          <div style={{ padding: 24, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa', textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#888' }}>
              No growth experiments logged yet. Ask Revvy to design and run a growth experiment!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {experiments.map((exp) => (
              <div key={exp.id}>
                <ExperimentCard experiment={exp} />
                <FeedbackWidget
                  page="/campaigns"
                  itemId={String(exp.id)}
                  itemType="growth-experiment"
                  label="Is this experiment insightful?"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Page-Level Feedback ---- */}
      <div style={{ marginTop: 24 }}>
        <FeedbackWidget page="/campaigns" label="Is this campaigns page useful?" />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper Components                                                  */
/* ------------------------------------------------------------------ */

/**
 * Renders a single growth experiment as a structured card.
 */
function ExperimentCard({ experiment }: { experiment: GrowthExperiment }) {
  const date = new Date(experiment.created_at);
  const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const statusColors: Record<string, { bg: string; text: string }> = {
    planned: { bg: '#f3f4f6', text: '#6b7280' },
    active: { bg: '#dbeafe', text: '#2563eb' },
    running: { bg: '#dbeafe', text: '#2563eb' },
    completed: { bg: '#dcfce7', text: '#16a34a' },
    paused: { bg: '#fef3c7', text: '#d97706' },
    failed: { bg: '#fee2e2', text: '#dc2626' },
  };
  const sColor = statusColors[experiment.status] || statusColors['planned'];

  return (
    <div
      style={{
        padding: 20,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fafafa',
        borderLeft: `4px solid ${sColor.text}`,
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1a1a2e' }}>
          {experiment.title}
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: sColor.text,
              background: sColor.bg,
              padding: '3px 10px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}
          >
            {experiment.status}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#6366f1',
              background: '#eef2ff',
              padding: '3px 10px',
              borderRadius: 4,
            }}
          >
            {experiment.experiment_type}
          </span>
          <span style={{ fontSize: 12, color: '#888' }}>{dateStr}</span>
        </div>
      </div>

      {/* Hypothesis */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
          Hypothesis
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
          {experiment.hypothesis}
        </p>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
          Description
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
          {experiment.description}
        </p>
      </div>

      {/* Results (if completed) */}
      {experiment.results && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
            Results
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
            {experiment.results}
          </p>
        </div>
      )}

      {/* Platforms */}
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
        Platforms: {experiment.platforms}
      </div>
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

/**
 * Converts a platform slug to a human-readable name.
 */
function formatPlatform(platform: string): string {
  const map: Record<string, string> = {
    twitter: 'Twitter/X',
    github: 'GitHub',
    slack: 'Slack',
    site: 'Website',
  };
  return map[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

/**
 * Converts an action slug to a human-readable label.
 */
function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
