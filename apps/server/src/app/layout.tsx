import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { getDb, seedProjectsIfEmpty } from '@taskyard/core';
import { AuthGate } from '@/components/auth-gate';
import { Providers } from '@/components/providers';
import { readWebGate, SESSION_COOKIE } from '@/lib/web-session';
import { ACTIVE_COLLECTION_COOKIE } from '@/lib/active-collection';

export const metadata: Metadata = {
  title: 'Taskyard',
  description: 'Self-hosted AI agent orchestrator',
  icons: {
    icon: '/favicon.png',
  },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  seedProjectsIfEmpty(getDb());
  const jar = await cookies();
  const gate = readWebGate(jar.get(SESSION_COOKIE)?.value);
  const collectionId = jar.get(ACTIVE_COLLECTION_COOKIE)?.value || null;

  return (
    <html lang="en">
      <body>
        <Providers person={gate.kind === 'app' ? gate.person : null} collectionId={collectionId}>
          {gate.kind === 'app' ? children : <AuthGate gate={gate} />}
        </Providers>
      </body>
    </html>
  );
}
