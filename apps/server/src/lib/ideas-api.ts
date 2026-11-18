import type { NextResponse } from 'next/server';
import { IdeaError, ProjectError, type PersonRecord } from '@taskyard/core';
import { jsonError } from '@/lib/api-response';
import { requireFullSession } from '@/lib/people-api';

export function ideaErrorResponse(err: unknown, fallback: string) {
  if (err instanceof IdeaError) return jsonError(err.message, err.statusCode);
  if (err instanceof ProjectError) return jsonError(err.message, 400, { code: 'PROJECT_ERROR' });
  return jsonError(err instanceof Error ? err.message : fallback, 500);
}

export function requireIdeaPerson(
  req: Request,
): { ok: true; person: PersonRecord; webSession: boolean } | { ok: false; response: NextResponse } {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate;
  return { ok: true, person: gate.person, webSession: gate.kind === 'web' };
}

export function ideaActor(person: PersonRecord, webSession: boolean, requested?: string): string {
  return webSession ? person.displayName : requested?.trim() || person.displayName;
}
