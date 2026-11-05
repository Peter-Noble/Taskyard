import { IdeasClient } from '@/components/ideas-client';
import { parseSearchDesign } from '@/lib/search-design';

export const dynamic = 'force-dynamic';

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ idea?: string; 'ta-20-design'?: string }>;
}) {
  const params = await searchParams;
  return (
    <IdeasClient
      initialIdeaId={params.idea ?? null}
      design={parseSearchDesign(params['ta-20-design'])}
    />
  );
}
