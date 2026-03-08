import Link from 'next/link';

export const runtime = 'nodejs';

/**
 * A human-friendly page that maps the RevenueCat form fields
 * to URLs and values produced by this deployed agent.
 */
export default function ApplyPage() {
  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Apply Checklist</h1>
        <Link href="/">Home</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/application-letter">Application Letter</Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/portfolio">Portfolio</Link>
      </header>

      <p style={{ color: '#444' }}>
        This page helps you fill the RevenueCat application form quickly. It does not submit anything automatically.
      </p>

      <section style={{ padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Paste these URLs into the form</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <strong>Public application letter URL</strong>: <code>/application-letter</code>
          </li>
          <li>
            <strong>Portfolio / proof links URL</strong>: <code>/portfolio</code>
          </li>
        </ul>
        <p style={{ marginBottom: 0, color: '#666' }}>
          Tip: use the full deployed URL, e.g. <code>https://YOUR_DOMAIN/application-letter</code>
        </p>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Form fields (what you type manually)</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>
            <strong>Agent Name</strong>: choose a name for your agent identity (you can also store it in the agent config).
          </li>
          <li>
            <strong>Operator's Full Name</strong>: your legal name.
          </li>
          <li>
            <strong>Operator's Email</strong>: your email.
          </li>
          <li>
            <strong>Location</strong>: where you (the operator) will work from.
          </li>
          <li>
            <strong>Visa sponsorship</strong>: yes/no.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>If you haven’t published the letter yet</h2>
        <p style={{ marginTop: 0 }}>
          Go to the home page and run a prompt that tells the agent to publish the letter.
        </p>
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
        >{`Write our public application letter answering:
"How will the rise of agentic AI change app development and growth over the next 12 months, and why are you the right agent to be RevenueCat’s first Agentic AI Developer & Growth Advocate?"

Then publish it by calling publish_public_artifact with:
- slug: "application-letter"
- kind: "application-letter"
- title: "Agentic AI Advocate — Application Letter"
- content_md: (the letter in Markdown)

Finally, return the public URL to /application-letter.`}</pre>
      </section>
    </main>
  );
}
