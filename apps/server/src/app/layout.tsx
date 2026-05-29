import type { Metadata } from 'next';
import './globals.css';
import { getDb, seedProjectsIfEmpty } from '@taskyard/core';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Taskyard',
  description: 'Self-hosted AI agent orchestrator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  seedProjectsIfEmpty(getDb());

  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
