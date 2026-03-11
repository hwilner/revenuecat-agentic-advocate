import Link from 'next/link';

export const runtime = 'nodejs';

/**
 * A helper page that shows how to use the agent to publish content.
 */
export default function ApplyPage() {
  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Content Publishing Guide</h1>
        <Link href="/">Home</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/application-letter">Application Letter</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/portfolio">Portfolio</Link>
      </header>

      <p style={{ color: '#444' }}>
        Use this page as a quick reference for publishing content with Revvy. All published artifacts are publicly accessible and listed in the portfolio.
      </p>

      <section style={{ padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Published Content</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <strong>Cover letter / application letter</strong>: <Link href="/application-letter"><code>/application-letter</code></Link>
          </li>
          <li>
            <strong>All published artifacts</strong>: <Link href="/portfolio"><code>/portfolio</code></Link>
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Publish a new cover letter, blog post, or article</h2>
        <p style={{ marginTop: 0 }}>
          Go to the <Link href="/">home page</Link> and give Revvy a prompt. Here are some examples:
        </p>

        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Cover Letter</h3>
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
        >{`Write and publish a cover letter about how agentic AI will change app development and growth, and why Revvy is the right agent for the job. Publish it to /application-letter.`}</pre>

        <h3 style={{ fontSize: 15, marginBottom: 8, marginTop: 16 }}>Blog Post</h3>
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
        >{`Write and publish a technical blog post about integrating RevenueCat subscriptions with an AI agent framework using the MCP Server.`}</pre>

        <h3 style={{ fontSize: 15, marginBottom: 8, marginTop: 16 }}>Tweet Thread</h3>
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
        >{`Draft a 5-tweet thread about why AI agents need RevenueCat for subscription management.`}</pre>
      </section>
    </main>
  );
}
