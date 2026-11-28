import { cookies } from 'next/headers';
import { DashboardClient } from '@/components/dashboard-client';
import { PANEL_VISIBILITY_COOKIE, parsePanelVisibility } from '@/lib/panel-visibility';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; 'ta-27-design'?: string }>;
}) {
  const jar = await cookies();
  const params = await searchParams;
  const initialPanels = parsePanelVisibility(jar.get(PANEL_VISIBILITY_COOKIE)?.value);
  const design = params['ta-27-design'];
  return (
    <DashboardClient
      initialPanels={initialPanels}
      initialTaskId={params.task ?? null}
      initialCategoryDesign={design === 'A' || design === 'B' || design === 'C' ? design : undefined}
    />
  );
}
