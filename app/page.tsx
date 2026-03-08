'use client';

import { useState } from 'react';

type Mode = 'execution' | 'interview';

export default function Page() {
  const [mode, setMode] = useState<Mode>('interview');
  const [prompt, setPrompt] = useState('Explain the architecture and show how you avoid hallucinations.');
  const [upgradeToken, setUpgradeToken] = useState('');
  const [out, setOut] = useState('');
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setOut('');

    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, prompt, upgrade_token: upgradeToken || undefined }),
    });

    if (!res.ok) {
      const text = await res.text();
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

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>RevenueCat Interview Agent</h1>
      <p style={{ color: '#444', lineHeight: 1.4 }}>
        This is a deployable Vercel app. The agent is restricted to the RevenueCat work description.
        If a user requests extra work, the system issues a single-use upgrade token via Telegram.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label>
          Mode:{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="interview">interview</option>
            <option value="execution">execution</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          Upgrade token (optional):{' '}
          <input
            value={upgradeToken}
            onChange={(e) => setUpgradeToken(e.target.value)}
            placeholder="Paste token from Telegram"
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
        style={{ width: '100%', fontFamily: 'ui-monospace, SFMono-Regular', padding: 12 }}
      />

      <pre
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

      <p style={{ color: '#666', fontSize: 13 }}>
        Links: <a href="/apply">/apply</a> |{' '}
        <a href="/application-letter">/application-letter</a> |{' '}
        <a href="/portfolio">/portfolio</a> |{' '}
        <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
