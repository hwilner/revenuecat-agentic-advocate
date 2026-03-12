import Link from 'next/link';
import { getEvolutionHistory, getLearningStats } from '@/lib/learning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function EvolutionPage() {
  let stats;
  let history;

  try {
    [stats, history] = await Promise.all([
      getLearningStats(),
      getEvolutionHistory(),
    ]);
  } catch {
    stats = null;
    history = [];
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Evolution Log</h1>
        <Link href="/">Home</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/portfolio">Portfolio</Link>
      </header>

      <p style={{ color: '#444', lineHeight: 1.5 }}>
        Revvy is a self-improving agent. After every interaction, it reflects on what it learned.
        Periodically, it analyzes accumulated insights and autonomously updates its own prompts
        and knowledge base. This page shows that evolution in real time.
      </p>

      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard label="Current Generation" value={`Gen ${stats.currentGeneration}`} />
          <StatCard label="Insights Collected" value={String(stats.totalInsights)} />
          <StatCard label="Insights Applied" value={String(stats.appliedInsights)} />
          <StatCard label="Self-Improvements" value={String(stats.totalEvolutions)} />
          <StatCard label="User Feedback" value={String(stats.totalFeedback)} />
          <StatCard
            label="Avg Rating"
            value={stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : 'N/A'}
          />
          <StatCard label="Learned Facts" value={String(stats.dynamicFacts)} />
        </div>
      )}

      <h2>Evolution Timeline</h2>

      {history.length === 0 ? (
        <div
          style={{
            padding: 20,
            border: '1px solid #ddd',
            borderRadius: 12,
            background: '#f9f9f9',
          }}
        >
          <p style={{ margin: 0, color: '#666' }}>
            No evolution events yet. The agent will self-improve after accumulating enough
            interactions and insights. Keep chatting with Revvy!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {history.map((event) => (
            <div
              key={event.id}
              style={{
                padding: 16,
                border: '1px solid #e0e0e0',
                borderRadius: 12,
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ color: '#1a73e8' }}>{event.trigger}</strong>
                <span style={{ color: '#666', fontSize: 13 }}>
                  {new Date(event.created_at).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{event.changes_summary}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 16,
        border: '1px solid #e0e0e0',
        borderRadius: 12,
        background: '#f5f5f5',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 700, color: '#1a73e8' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{label}</div>
    </div>
  );
}
