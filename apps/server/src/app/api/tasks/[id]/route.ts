import type { TaskStatus, UpdateTaskRequest } from '@taskyard/protocol';
import { getDb, getTaskDetail, updateTask } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { actorFromWebSession } from '@/lib/people-api';
import { taskErrorResponse } from '@/lib/task-error';

type Params = { params: Promise<{ id: string }> };

const TASK_STATUSES: TaskStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'review',
  'merge',
  'waiting',
  'completed',
  'cancelled',
];

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const task = getTaskDetail(db, id);
  if (!task) return jsonError('Task not found', 404);
  return jsonOk({ task });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  let body: UpdateTaskRequest;
  try {
    body = (await req.json()) as UpdateTaskRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (body.status && !TASK_STATUSES.includes(body.status)) {
    return jsonError(`Invalid status: ${body.status}`, 400);
  }

  const actor = actorFromWebSession(req, body.actor);
  if (!actor.ok) return actor.response;

  const db = getDb();
  try {
    const task = updateTask(db, id, { ...body, actor: actor.actor });
    if (!task) return jsonError('Task not found', 404);
    return jsonOk({ task });
  } catch (err) {
    return taskErrorResponse(err, 'Failed to update task');
  }
}
