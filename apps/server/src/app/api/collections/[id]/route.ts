import { deleteCollection, getDb } from '@taskyard/core';
import { jsonOk } from '@/lib/api-response';
import { collectionErrorResponse, requireFullSession } from '@/lib/collections-api';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    deleteCollection(getDb(), gate.personId, id);
    return jsonOk({ ok: true });
  } catch (err) {
    return collectionErrorResponse(err, 'Failed to delete the collection');
  }
}
