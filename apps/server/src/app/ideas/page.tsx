import { IdeasClient } from '@/components/ideas-client';

export const dynamic = 'force-dynamic';

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ idea?: string }>;
}) {
  const params = await searchParams;
  return <IdeasClient initialIdeaId={params.idea ?? null} />;
}
