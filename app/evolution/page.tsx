import Link from 'next/link';
import { getEvolutionHistory, getLearningStats } from '@/lib/learning';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Types for the additional data sources displayed on the evolution page.
 */
type LearningJournalEntry = {
  id: number;
  created_at: string;
  run_id: string;
  insight: string;
  category: string;
  applied: boolean;
};

type SelfEditEvent = {
  id: number;
  created_at: string;
  kind: string;
  summary: string;
};

type DynamicFact = {
  id: number;
  created_at: string;
  category: string;
  fact: string;
  confidence: number;
  active: boolean;
};

/**
 * Evolution Log Page.
 *
 * Displays the agent's self-improvement history, including:
 * - Learning stats (generation, insights, feedback)
 * - Evolution timeline (major self-improvement events)
 * - Learning journal (per-interaction reflections)
 * - Self-edit audit trail (prompt/config changes)
 * - Dynamic knowledge base (learned facts)
 *
 * This page serves as proof that the agent has genuine self-learning
 * capabilities and can evolve its behavior over time.
 */
export default async function EvolutionPage() {
  let stats: Awaited<ReturnType<typeof getLearningStats>> | null = null;
  let history: Awaited<ReturnType<typeof getEvolutionHistory>> = [];
  let journalEntries: LearningJournalEntry[] = [];
  let selfEdits: SelfEditEvent[] = [];
  let dynamicFacts: DynamicFact[] = [];

  try {
    [stats, history] = await Promise.all([
      getLearningStats(),
      getEvolutionHistory(),
    ]);
  } catch {
    stats = null;
    history = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Load learning journal entries (per-interaction reflections)         */
  /* ------------------------------------------------------------------ */
  try {
    journalEntries = await sql()<LearningJournalEntry[]>`
      select id, created_at, run_id, insight, category, applied
      from learning_journal
      order by created_at desc
      limit 30
    `;
  } catch {
    /* Table may not exist yet */
  }

  /* ------------------------------------------------------------------ */
  /*  Load self-edit audit trail                                         */
  /* ------------------------------------------------------------------ */
  try {
    selfEdits = await sql()<SelfEditEvent[]>`
      select id, created_at, kind, summary
      from self_edit_events
      order by created_at desc
      limit 20
    `;
  } catch {
    /* Table may not exist yet */
  }

  /* ------------------------------------------------------------------ */
  /*  Load dynamic knowledge facts                                       */
  /* ------------------------------------------------------------------ */
  try {
    dynamicFacts = await sql()<DynamicFact[]>`
      select id, created_at, category, fact, confidence, active
      from dynamic_knowledge
      where active = true
      order by confidence desc, created_at desc
      limit 30
    `;
  } catch {
    /* Table may not exist yet */
  }

  /* ------------------------------------------------------------------ */
  /*  Group dynamic facts by category                                    */
  /* ------------------------------------------------------------------ */
  const factsByCategory = new Map<string, DynamicFact[]>();
  for (const fact of dynamicFacts) {
    if (!factsByCategory.has(fact.category)) factsByCategory.set(fact.category, []);
    factsByCategory.get(fact.category)!.push(fact);
  }

  return (
    <main style={{ padding: '24px 16px', maxWidth: 980, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ---- Header ---- */}
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Evolution Log</h1>
        <nav style={{ display: 'flex', gap: 8, fontSize: 14 }}>
          <Link href="/" style={{ color: '#6366f1' }}>Home</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/portfolio" style={{ color: '#6366f1' }}>Portfolio</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/feedback" style={{ color: '#6366f1' }}>Product Feedback</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/campaigns" style={{ color: '#6366f1' }}>Growth Campaigns</Link>
          <span style={{ color: '#ccc' }}>|</span>
          <Link href="/health" style={{ color: '#6366f1' }}>Health Dashboard</Link>
        </nav>
      </header>

      <p style={{ color: '#555', lineHeight: 1.5, marginTop: 12 }}>
        Revvy is a self-improving agent. After every interaction, it reflects on what it learned.
        Periodically, it analyzes accumulated insights and autonomously updates its own prompts
        and knowledge base. This page shows that evolution in real time.
      </p>

      {/* ---- Stats Dashboard ---- */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard label="Current Generation" value={`Gen ${stats.currentGeneration}`} color="#6366f1" />
          <StatCard label="Insights Collected" value={String(stats.totalInsights)} color="#10b981" />
          <StatCard label="Insights Applied" value={String(stats.appliedInsights)} color="#3b82f6" />
          <StatCard label="Self-Improvements" value={String(stats.totalEvolutions)} color="#f59e0b" />
          <StatCard label="User Feedback" value={String(stats.totalFeedback)} color="#8b5cf6" />
          <StatCard
            label="Avg Rating"
            value={stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : 'N/A'}
            color="#ec4899"
          />
          <StatCard label="Learned Facts" value={String(stats.dynamicFacts)} color="#14b8a6" />
        </div>
      )}

      {/* ---- Evolution Timeline ---- */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 16 }}>
          Evolution Timeline
        </h2>

        {history.length === 0 ? (
          <EmptyState message="No evolution events yet. The agent will self-improve after accumulating enough interactions and insights." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.map((event) => (
              <div
                key={event.id}
                style={{
                  padding: 16,
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  background: '#fafafa',
                  borderLeft: '4px solid #6366f1',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <strong style={{ color: '#6366f1' }}>{event.trigger}</strong>
                  <span style={{ color: '#888', fontSize: 13 }}>
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: 0, lineHeight: 1.5, color: '#374151' }}>{event.changes_summary}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Self-Edit Audit Trail ---- */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 16 }}>
          Self-Edit Audit Trail
        </h2>

        {selfEdits.length === 0 ? (
          <EmptyState message="No self-edit events recorded yet. The agent logs every change it makes to its own configuration." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selfEdits.map((edit) => (
              <div
                key={edit.id}
                style={{
                  padding: 14,
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  background: '#f9fafb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#6366f1',
                      background: '#eef2ff',
                      padding: '2px 8px',
                      borderRadius: 4,
                      marginRight: 8,
                    }}
                  >
                    {edit.kind}
                  </span>
                  <span style={{ fontSize: 14, color: '#374151' }}>{edit.summary}</span>
                </div>
                <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
                  {new Date(edit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Learning Journal ---- */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 16 }}>
          Learning Journal
        </h2>

        {journalEntries.length === 0 ? (
          <EmptyState message="No learning journal entries yet. After each interaction, Revvy reflects and records insights here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {journalEntries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: 14,
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  background: '#f9fafb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#10b981',
                        background: '#ecfdf5',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {entry.category}
                    </span>
                    {entry.applied && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#3b82f6',
                          background: '#dbeafe',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        Applied
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
                  {entry.insight}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Dynamic Knowledge Base ---- */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '2px solid #e5e7eb', paddingBottom: 8, marginBottom: 16 }}>
          Dynamic Knowledge Base
        </h2>

        {dynamicFacts.length === 0 ? (
          <EmptyState message="No dynamic knowledge acquired yet. As Revvy learns, it stores facts here for use in future interactions." />
        ) : (
          Array.from(factsByCategory.entries()).map(([category, facts]) => (
            <div key={category} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                {category}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {facts.map((fact) => (
                  <div
                    key={fact.id}
                    style={{
                      padding: 10,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#f9fafb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 14, color: '#374151' }}>{fact.fact}</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: '#888',
                        whiteSpace: 'nowrap',
                        marginLeft: 12,
                      }}
                    >
                      {(fact.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper Components                                                  */
/* ------------------------------------------------------------------ */

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
 * Displays an empty state message when no data is available.
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 24,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        background: '#fafafa',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, color: '#888' }}>{message}</p>
    </div>
  );
}
