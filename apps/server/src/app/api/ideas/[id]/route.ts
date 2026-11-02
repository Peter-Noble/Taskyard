import type { UpdateIdeaRequest } from '@taskyard/protocol';
import { getDb, getIdeaDetail, updateIdea } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { ideaActor, ideaErrorResponse, requireIdeaPerson } from '@/lib/ideas-api';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  const idea = getIdeaDetail(getDb(), (await params).id, gate.person.id);
  if (!idea) return jsonError('Idea not found.', 404);
  return jsonOk({ idea });
}

export async function PATCH(req: Request, { params }: Params) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  let body: UpdateIdeaRequest;
  try {
    body = (await req.json()) as UpdateIdeaRequest;
  } catch {
    return jsonError('Invalid JSON');
  }
  try {
    const idea = updateIdea(
      getDb(),
      (await params).id,
      gate.person.id,
      body,
      ideaActor(gate.person, gate.webSession, body.actor),
    );
    return jsonOk({ idea });
  } catch (err) {
    return ideaErrorResponse(err, 'Failed to update idea');
  }
}
