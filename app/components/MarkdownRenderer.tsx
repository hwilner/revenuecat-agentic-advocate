import { marked } from 'marked';

export default function MarkdownRenderer({ content }: { content: string }) {
  const html = marked.parse(content || '', { async: false }) as string;

  return (
    <article
      className="markdown-body"
      style={{
        lineHeight: 1.7,
        fontSize: 16,
        color: '#1a1a2e',
        maxWidth: '100%',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
