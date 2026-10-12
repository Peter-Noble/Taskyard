import type { NextRequest } from 'next/server';

/** Canonical public origin for this Taskyard instance (install scripts, copy-paste). */
export function resolvePublicUrl(req: NextRequest): string {
  const fromEnv = process.env.TASKYARD_PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const proto =
    req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    req.nextUrl.protocol.replace(/:$/, '') ||
    'http';
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host')?.trim() ||
    req.nextUrl.host;
  return `${proto}://${host}`.replace(/\/+$/, '');
}
