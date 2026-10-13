import { cookies } from 'next/headers';
import { DashboardClient } from '@/components/dashboard-client';
import { parseTa35Design } from '@/lib/ta-35-design';
import { parseTa35Labels } from '@/lib/ta-35-labels';
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
  const ta35Labels = parseTa35Labels(params['ta-35-labels']);
  return (
    <DashboardClient
      initialPanels={initialPanels}
      ta35Design={ta35Design}
      ta35Labels={ta35Labels}
    />
  );
}
