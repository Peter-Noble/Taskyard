import type { CreateIdeaRequest, IdeaStatus } from '@taskyard/protocol';
import { createIdea, getDb, listIdeas } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { ideaActor, ideaErrorResponse, requireIdeaPerson } from '@/lib/ideas-api';

const IDEA_STATUSES: IdeaStatus[] = ['active', 'archived', 'promoted'];

export async function GET(req: Request) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  const params = new URL(req.url).searchParams;
  const status = params.get('status');
  if (status && !IDEA_STATUSES.includes(status as IdeaStatus)) {
    return jsonError(`Invalid status: ${status}`, 400);
  }
  return jsonOk({
    ideas: listIdeas(getDb(), gate.person.id, {
      collectionId: params.get('collection_id') ?? undefined,
      status: (status as IdeaStatus | null) ?? undefined,
    }),
  });
}

export async function POST(req: Request) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  let body: CreateIdeaRequest & { actor?: string };
  try {
    body = (await req.json()) as CreateIdeaRequest & { actor?: string };
  } catch {
    return jsonError('Invalid JSON');
  }
  try {
    const idea = createIdea(
      getDb(),
      gate.person.id,
      body,
      ideaActor(gate.person, gate.webSession, body.actor),
    );
    return jsonOk({ idea }, 201);
  } catch (err) {
    return ideaErrorResponse(err, 'Failed to create idea');
  }
}
