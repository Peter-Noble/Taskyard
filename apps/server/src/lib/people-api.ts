import { NextResponse } from 'next/server';
import { getDb, PeopleError, personFromToken, type PersonRecord } from '@taskyard/core';
import { jsonError } from '@/lib/api-response';
import { sessionTokenFromRequest } from '@/lib/web-session';

export function peopleErrorResponse(err: unknown, fallback: string) {
  if (err instanceof PeopleError) return jsonError(err.message, err.statusCode);
  return jsonError(fallback, 500);
}

export function requireFullSession(
  req: Request,
): { ok: true; person: PersonRecord } | { ok: false; response: NextResponse } {
  const token = sessionTokenFromRequest(req);
  if (!token) return { ok: false, response: jsonError('Sign in required.', 401) };
  const session = personFromToken(getDb(), token);
  if (!session) return { ok: false, response: jsonError('Sign in required.', 401) };
  if (session.mustChangePassword) {
    return { ok: false, response: jsonError('Set a new password before using Taskyard.', 403) };
  }
  return { ok: true, person: session.person };
}

/** A web session replaces the request actor. No cookie keeps the caller's actor, so the CLI stays open. */
export function actorFromWebSession(
  req: Request,
  bodyActor: string | undefined,
): { ok: true; actor: string } | { ok: false; response: NextResponse } {
  const token = sessionTokenFromRequest(req);
  if (!token) return { ok: true, actor: bodyActor?.trim() || 'user' };
  const session = personFromToken(getDb(), token);
  if (!session) return { ok: true, actor: bodyActor?.trim() || 'user' };
  if (session.mustChangePassword) {
    return { ok: false, response: jsonError('Set a new password before using Taskyard.', 403) };
  }
  return { ok: true, actor: session.person.displayName };
}
