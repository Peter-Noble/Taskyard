import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { canReadThread, getDb, getThreadDetail } from '@taskyard/core';
import { ThreadDetailClient } from '@/components/thread-detail-client';
import { readWebGate, SESSION_COOKIE } from '@/lib/web-session';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function ThreadDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (id.startsWith('demo-')) {
    return <ThreadDetailClient demoThreadId={id} />;
  }

  const thread = getThreadDetail(getDb(), id);
  if (!thread) notFound();
  if (thread.idea_id) {
    const jar = await cookies();
    const gate = readWebGate(jar.get(SESSION_COOKIE)?.value);
    if (gate.kind !== 'app' || !canReadThread(getDb(), id, gate.person.id)) notFound();
  }
  return <ThreadDetailClient initialThread={thread} />;
}
