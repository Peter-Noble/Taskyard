import { cookies } from 'next/headers';
import { DashboardClient } from '@/components/dashboard-client';
import { parseTa35Design } from '@/components/ta-35-filter-design';
import { PANEL_VISIBILITY_COOKIE, parsePanelVisibility } from '@/lib/panel-visibility';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const initialPanels = parsePanelVisibility(jar.get(PANEL_VISIBILITY_COOKIE)?.value);
  const params = await searchParams;
  const ta35Design = parseTa35Design(params['ta-35-design']);
  return <DashboardClient initialPanels={initialPanels} ta35Design={ta35Design} />;
}
