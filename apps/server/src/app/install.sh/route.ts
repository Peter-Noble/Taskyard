import { NextResponse, type NextRequest } from 'next/server';
import { INSTALL_SH_TEMPLATE } from '@/install/templates';
import { resolvePublicUrl } from '@/lib/public-url';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  const base = resolvePublicUrl(req);
  const body = INSTALL_SH_TEMPLATE.replaceAll('__TASKYARD_SERVER_URL__', base).replaceAll(
    '__TASKYARD_BASE_URL__',
    base,
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
