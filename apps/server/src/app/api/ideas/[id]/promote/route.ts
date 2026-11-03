import type { PromoteIdeaRequest } from '@taskyard/protocol';
import { getDb, promoteIdea } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { ideaActor, ideaErrorResponse, requireIdeaPerson } from '@/lib/ideas-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  let body: PromoteIdeaRequest;
  try {
    body = (await req.json()) as PromoteIdeaRequest;
  } catch {
    return jsonError('Invalid JSON');
  }
  try {
    const result = promoteIdea(
      getDb(),
      (await params).id,
      gate.person.id,
      body,
      ideaActor(gate.person, gate.webSession, body.actor),
    );
    return jsonOk(result);
  } catch (err) {
    return ideaErrorResponse(err, 'Failed to promote idea');
  }
}
