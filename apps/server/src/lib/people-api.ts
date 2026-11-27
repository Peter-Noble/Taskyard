import { NextResponse } from 'next/server';
import { getDb, PeopleError, personFromToken, type WebSession } from '@taskyard/core';
import { jsonError } from '@/lib/api-response';
import { sessionTokenFromRequest } from '@/lib/web-session';

export function peopleErrorResponse(err: unknown, fallback: string) {
  if (err instanceof PeopleError) return jsonError(err.message, err.statusCode);
  return jsonError(fallback, 500);
}

export function requireFullSession(
  req: Request,
): ({ ok: true } & WebSession) | { ok: false; response: NextResponse } {
  const token = sessionTokenFromRequest(req);
  if (!token) return { ok: false, response: jsonError('Sign in required.', 401) };
  const session = personFromToken(getDb(), token);
  if (!session) return { ok: false, response: jsonError('Sign in required.', 401) };
  if (session.mustChangePassword) {
    return { ok: false, response: jsonError('Set a new password before using Taskyard.', 403) };
  }
  return { ok: true, ...session };
}

export function sessionActor(session: WebSession): string {
  return session.person.displayName;
}
