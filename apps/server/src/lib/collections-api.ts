import { NextResponse } from 'next/server';
import { CollectionError, type CollectionRecord } from '@taskyard/core';
import { jsonError } from '@/lib/api-response';
import { requireIdeaPerson } from '@/lib/ideas-api';

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
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate;
  return { ok: true, personId: gate.person.id };
}
