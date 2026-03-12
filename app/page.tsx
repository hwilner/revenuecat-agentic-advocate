'use client';
import { useState, useRef } from 'react';

export default function Page() {
  const [prompt, setPrompt] = useState('');
  const [upgradeToken, setUpgradeToken] = useState('');
  const [out, setOut] = useState('');
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const outRef = useRef<HTMLPreElement>(null);

  async function run() {
    setLoading(true);
    setOut('');
    setRunId(null);
    setFeedbackSent(false);

    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, upgrade_token: upgradeToken || undefined }),
    });

    // Capture run_id from header
    const rid = res.headers.get('x-run-id');
    if (rid) setRunId(rid);

    if (!res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.run_id) setRunId(json.run_id);
      } catch {}
      setOut(text);
      setLoading(false);
      return;
    }

    // Stream response.
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      setOut(await res.text());
      setLoading(false);
      return;
    }
    let acc = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      acc += chunk;
      setOut(acc);
    }
    setLoading(false);
  }

  async function sendFeedback(rating: number) {
    if (!runId || feedbackSent) return;
    setFeedbackSent(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ run_id: runId, rating }),
      });
    } catch (e) {
      console.error('Feedback failed:', e);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>RevenueCat Agentic AI Advocate</h1>
      <p style={{ color: '#444', lineHeight: 1.4 }}>
        This agent autonomously handles RevenueCat-related tasks: writing content, answering interview questions,
        publishing artifacts, and interacting with RevenueCat APIs. Just describe what you need — the agent
        automatically determines the best approach.
      </p>

      <div
        style={{
          padding: 12,
          marginBottom: 16,
          background: '#f0f7ff',
          borderRadius: 8,
          border: '1px solid #d0e3ff',
          fontSize: 13,
          color: '#1a56db',
        }}
      >
        <strong>Self-improving agent</strong> — Revvy learns from every interaction. After each response, it reflects
        on what worked and what didn&apos;t. Every 10 interactions, it autonomously updates its own prompts and knowledge base.{' '}
        <a href="/evolution" style={{ color: '#1a56db' }}>View evolution log</a>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ flex: 1 }}>
          Upgrade token (optional):{' '}
          <input
            value={upgradeToken}
            onChange={(e) => setUpgradeToken(e.target.value)}
            placeholder="Paste token from Telegram (only needed for RevenueCat config changes)"
            style={{ width: '100%' }}
          />
        </label>
        <button onClick={run} disabled={loading}>
          {loading ? 'Running…' : 'Run'}
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={6}
        placeholder="Ask a question, request content, or give a task. Examples:&#10;• Write a blog post about agentic AI and RevenueCat subscription management&#10;• Explain your architecture and how you avoid hallucinations&#10;• Write and publish a cover letter about why Revvy is the right agent for the job"
        style={{ width: '100%', fontFamily: 'ui-monospace, SFMono-Regular', padding: 12 }}
      />
      <pre
        ref={outRef}
        style={{
          marginTop: 16,
          padding: 12,
          background: '#0b1020',
          color: '#e6e6e6',
          borderRadius: 8,
          minHeight: 240,
          whiteSpace: 'pre-wrap',
        }}
      >
        {out}
      </pre>

      {/* Feedback buttons — appear after a response */}
      {runId && out && !loading && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          {feedbackSent ? (
            <span style={{ color: '#666', fontSize: 13 }}>Thanks for the feedback! This helps Revvy learn.</span>
          ) : (
            <>
              <span style={{ color: '#666', fontSize: 13 }}>Rate this response:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => sendFeedback(n)}
                  style={{
                    padding: '4px 10px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    background: '#f5f5f5',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                  title={
                    n === 1 ? 'Poor' : n === 2 ? 'Below average' : n === 3 ? 'OK' : n === 4 ? 'Good' : 'Excellent'
                  }
                >
                  {n === 1 ? '\u{1F44E}' : n === 2 ? '\u{1F610}' : n === 3 ? '\u{1F44D}' : n === 4 ? '\u{1F525}' : '\u{1F680}'}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <p style={{ color: '#666', fontSize: 13, marginTop: 16 }}>
        Links: <a href="/apply">Publishing Guide</a> |{' '}
        <a href="/application-letter">Application Letter</a> |{' '}
        <a href="/portfolio">Portfolio</a> |{' '}
        <a href="/evolution">Evolution Log</a> |{' '}
        <a href="/api/health">Health</a>
      </p>
    </main>
  );
}
