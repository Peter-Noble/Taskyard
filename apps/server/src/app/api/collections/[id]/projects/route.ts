import { addProjectToCollection, getDb, removeProjectFromCollection } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { collectionErrorResponse, collectionJson, requireFullSession } from '@/lib/collections-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  let body: { project_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON');
  }
  if (typeof body.project_id !== 'string' || !body.project_id) return jsonError('project_id is required');
  try {
    const collection = addProjectToCollection(getDb(), gate.personId, id, body.project_id);
    return jsonOk({ collection: collectionJson(collection) });
  } catch (err) {
    return collectionErrorResponse(err, 'Failed to add the project');
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const projectId = new URL(req.url).searchParams.get('project_id');
  if (!projectId) return jsonError('project_id is required');
  try {
    const collection = removeProjectFromCollection(getDb(), gate.personId, id, projectId);
    return jsonOk({ collection: collectionJson(collection) });
  } catch (err) {
    return collectionErrorResponse(err, 'Failed to remove the project');
  }
}
