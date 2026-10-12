import type { AddTaskCommentRequest } from '@taskyard/protocol';
import { addTaskComment, getDb, TaskError } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { actorFromWebSession } from '@/lib/people-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  let body: AddTaskCommentRequest;
  try {
    body = (await req.json()) as AddTaskCommentRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (typeof body.text !== 'string' || !body.text.trim()) {
    return jsonError('text is required');
  }

  const actor = actorFromWebSession(req, body.actor);
  if (!actor.ok) return actor.response;

  const db = getDb();
  try {
    const activity = addTaskComment(db, id, { ...body, actor: actor.actor });
    if (!activity) return jsonError('Task not found', 404);
    return jsonOk({ activity }, 201);
  } catch (err) {
    if (err instanceof TaskError) {
      return jsonError(err.message, 400, { code: 'TASK_ERROR' });
    }
    return jsonError(err instanceof Error ? err.message : 'Failed to add comment', 500);
  }
}
