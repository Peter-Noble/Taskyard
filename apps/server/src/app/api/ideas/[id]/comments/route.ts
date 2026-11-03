import type { AddIdeaCommentRequest } from '@taskyard/protocol';
import { addIdeaComment, getDb } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { ideaActor, ideaErrorResponse, requireIdeaPerson } from '@/lib/ideas-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  let body: AddIdeaCommentRequest;
  try {
    body = (await req.json()) as AddIdeaCommentRequest;
  } catch {
    return jsonError('Invalid JSON');
  }
  try {
    const activity = addIdeaComment(getDb(), (await params).id, gate.person.id, {
      ...body,
      actor: ideaActor(gate.person, gate.webSession, body.actor),
    });
    return jsonOk({ activity }, 201);
  } catch (err) {
    return ideaErrorResponse(err, 'Failed to comment on idea');
  }
}
