import { cookies } from 'next/headers';
import { DashboardClient } from '@/components/dashboard-client';
import { PANEL_VISIBILITY_COOKIE, parsePanelVisibility } from '@/lib/panel-visibility';
import { parseSearchDesign } from '@/lib/search-design';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; 'ta-20-design'?: string }>;
}) {
  const jar = await cookies();
  const params = await searchParams;
  const initialPanels = parsePanelVisibility(jar.get(PANEL_VISIBILITY_COOKIE)?.value);
  return (
    <DashboardClient
      initialPanels={initialPanels}
      initialTaskId={params.task ?? null}
      design={parseSearchDesign(params['ta-20-design'])}
    />
  );
}
