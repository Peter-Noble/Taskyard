import { createCollection, getDb, listCollections } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { collectionErrorResponse, collectionJson, requireFullSession } from '@/lib/collections-api';

export async function GET(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  return jsonOk({ collections: listCollections(getDb(), gate.personId).map(collectionJson) });
}

export async function POST(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  let body: { name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON');
  }
  if (typeof body.name !== 'string') return jsonError('name is required');
  try {
    const collection = createCollection(getDb(), gate.personId, body.name);
    return jsonOk({ collection: collectionJson(collection) }, 201);
  } catch (err) {
    return collectionErrorResponse(err, 'Failed to create the collection');
  }
}
