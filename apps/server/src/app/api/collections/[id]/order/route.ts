import type { ReorderProjectsRequest } from '@taskyard/protocol';
import { getDb, reorderCollectionProjects } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { collectionErrorResponse, collectionJson, requireFullSession } from '@/lib/collections-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  let body: ReorderProjectsRequest;
  try {
    body = (await req.json()) as ReorderProjectsRequest;
  } catch {
    return jsonError('Invalid JSON');
  }
  if (!Array.isArray(body.ids) || body.ids.some((item) => typeof item !== 'string')) {
    return jsonError('ids is required');
  }
  try {
    const collection = reorderCollectionProjects(getDb(), gate.personId, id, body.ids);
    return jsonOk({ collection: collectionJson(collection) });
  } catch (err) {
    return collectionErrorResponse(err, 'Failed to reorder the collection');
  }
}
