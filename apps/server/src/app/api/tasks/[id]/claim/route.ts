import type { ClaimTaskRequest } from '@taskyard/protocol';
import { claimTask, getDb } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { taskErrorResponse } from '@/lib/task-error';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  let body: ClaimTaskRequest;
  try {
    body = (await req.json()) as ClaimTaskRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!body.assignee?.trim()) return jsonError('assignee is required');

  const db = getDb();
  try {
    const task = claimTask(db, id, body.assignee, body.actor);
    if (!task) return jsonError('Task not found', 404);
    return jsonOk({ task });
  } catch (err) {
    return taskErrorResponse(err, 'Failed to claim task');
  }
}
