import type { NextResponse } from 'next/server';
import {
  getDb,
  getPerson,
  IdeaError,
  listPeople,
  personFromToken,
  ProjectError,
  type PersonRecord,
} from '@taskyard/core';
import { jsonError } from '@/lib/api-response';
import { sessionTokenFromRequest } from '@/lib/web-session';

export function ideaErrorResponse(err: unknown, fallback: string) {
  if (err instanceof IdeaError) return jsonError(err.message, err.statusCode);
  if (err instanceof ProjectError) return jsonError(err.message, 400, { code: 'PROJECT_ERROR' });
  return jsonError(err instanceof Error ? err.message : fallback, 500);
}

export function requireIdeaPerson(
  req: Request,
): { ok: true; person: PersonRecord; webSession: boolean } | { ok: false; response: NextResponse } {
  const db = getDb();
  const token = sessionTokenFromRequest(req);
  if (token) {
    const session = personFromToken(db, token);
    if (!session) return { ok: false, response: jsonError('Sign in required.', 401) };
    if (session.mustChangePassword) {
      return { ok: false, response: jsonError('Set a new password before using Taskyard.', 403) };
    }
    return { ok: true, person: session.person, webSession: session.kind === 'web' };
  }

  const personId = req.headers.get('x-taskyard-person-id');
  if (personId) {
    const person = getPerson(db, personId);
    return person
      ? { ok: true, person, webSession: false }
      : { ok: false, response: jsonError('CLI person not found.', 401) };
  }

  const people = listPeople(db);
  if (people.length === 1) return { ok: true, person: people[0]!, webSession: false };
  return {
    ok: false,
    response: jsonError('Sign in required. For a multi-person local CLI, set TASKYARD_PERSON_ID.', 401),
  };
}

export function ideaActor(person: PersonRecord, webSession: boolean, requested?: string): string {
  return webSession ? person.displayName : requested?.trim() || person.displayName;
}
