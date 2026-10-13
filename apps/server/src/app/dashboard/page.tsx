import { cookies } from 'next/headers';
import { DashboardClient } from '@/components/dashboard-client';
import { PANEL_VISIBILITY_COOKIE, parsePanelVisibility } from '@/lib/panel-visibility';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const jar = await cookies();
  const initialPanels = parsePanelVisibility(jar.get(PANEL_VISIBILITY_COOKIE)?.value);
  return <DashboardClient initialPanels={initialPanels} />;
}
