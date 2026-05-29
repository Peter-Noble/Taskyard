import { notFound } from 'next/navigation';
import { getDb, getThreadDetail } from '@taskyard/core';
import { ThreadDetailClient } from '@/components/thread-detail-client';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function ThreadDetailPage({ params }: PageProps) {
  const { id } = await params;

  if (id.startsWith('demo-')) {
    return <ThreadDetailClient demoThreadId={id} />;
  }

  const thread = getThreadDetail(getDb(), id);
  if (!thread) notFound();
  return <ThreadDetailClient initialThread={thread} />;
}
