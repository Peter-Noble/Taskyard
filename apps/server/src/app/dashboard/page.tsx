import { cookies } from 'next/headers';
import { DashboardClient } from '@/components/dashboard-client';
import { PANEL_VISIBILITY_COOKIE, parsePanelVisibility } from '@/lib/panel-visibility';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const jar = await cookies();
  const params = await searchParams;
  const initialPanels = parsePanelVisibility(jar.get(PANEL_VISIBILITY_COOKIE)?.value);
  return <DashboardClient initialPanels={initialPanels} initialTaskId={params.task ?? null} />;
}
