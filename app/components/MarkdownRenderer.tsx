'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <article
      className="markdown-body"
      style={{
        lineHeight: 1.7,
        fontSize: 16,
        color: '#1a1a2e',
        maxWidth: '100%',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 32, marginBottom: 12, borderBottom: '2px solid #e5e7eb', paddingBottom: 8 }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 28, marginBottom: 10, color: '#1a1a2e' }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 24, marginBottom: 8, color: '#333' }}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p style={{ marginTop: 8, marginBottom: 12, lineHeight: 1.7 }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ paddingLeft: 24, marginTop: 8, marginBottom: 12 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ paddingLeft: 24, marginTop: 8, marginBottom: 12 }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: 4, lineHeight: 1.6 }}>{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: '4px solid #6366f1',
                paddingLeft: 16,
                margin: '16px 0',
                color: '#555',
                fontStyle: 'italic',
              }}
            >
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <code
                  style={{
                    display: 'block',
                    background: '#0b1020',
                    color: '#e6e6e6',
                    padding: 16,
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    overflowX: 'auto',
                    whiteSpace: 'pre',
                  }}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                style={{
                  background: '#f3f4f6',
                  color: '#e11d48',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre style={{ margin: '16px 0', borderRadius: 8, overflow: 'auto' }}>{children}</pre>
          ),
          a: ({ href, children }) => (
            <a href={href} style={{ color: '#6366f1', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600, color: '#111' }}>{children}</strong>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ border: '1px solid #d1d5db', padding: '8px 12px', background: '#f9fafb', fontWeight: 600, textAlign: 'left' }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ border: '1px solid #d1d5db', padding: '8px 12px' }}>{children}</td>
          ),
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0' }} />,
        }}
      />
    </article>
  );
}
