import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RevenueCat Interview Agent',
  description: 'Dual-mode (execution/interview) agent with guardrails + upgrade tokens.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
