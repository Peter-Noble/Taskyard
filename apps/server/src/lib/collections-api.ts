import { NextResponse } from 'next/server';
import { CollectionError, getDb, personFromToken, type CollectionRecord } from '@taskyard/core';
import { jsonError } from '@/lib/api-response';
import { sessionTokenFromRequest } from '@/lib/web-session';

export function collectionJson(collection: CollectionRecord) {
  return {
    id: collection.id,
    name: collection.name,
    project_ids: collection.projectIds,
  };
}

export function collectionErrorResponse(err: unknown, fallback: string) {
  if (err instanceof CollectionError) return jsonError(err.message, err.statusCode);
  return jsonError(fallback, 500);
}

export function requireFullSession(
  req: Request,
): { ok: true; personId: string } | { ok: false; response: NextResponse } {
  const token = sessionTokenFromRequest(req);
  if (!token) return { ok: false, response: jsonError('Sign in required.', 401) };
  const session = personFromToken(getDb(), token);
  if (!session) return { ok: false, response: jsonError('Sign in required.', 401) };
  if (session.mustChangePassword) {
    return { ok: false, response: jsonError('Set a new password before using Taskyard.', 403) };
  }
  return { ok: true, personId: session.person.id };
}
