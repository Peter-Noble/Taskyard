import { NextResponse, type NextRequest } from 'next/server';
import { requireFullSession } from '@/lib/people-api';

// These handlers manage session creation, inspection, and restricted sessions themselves.
const SESSION_ROUTES = new Set([
  'POST /api/auth/setup',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/password',
  'GET /api/auth/session',
  'POST /api/auth/cli/start',
  'POST /api/auth/cli/poll',
]);

export function middleware(req: NextRequest): NextResponse {
  let response: NextResponse;
  if (SESSION_ROUTES.has(`${req.method} ${req.nextUrl.pathname}`)) {
    response = NextResponse.next();
  } else {
    const gate = requireFullSession(req);
    response = gate.ok ? NextResponse.next() : gate.response;
  }
  response.headers.set('Cache-Control', 'private, no-store, no-transform');
  return response;
}

export const config = {
  matcher: '/api/:path*',
  runtime: 'nodejs',
};
