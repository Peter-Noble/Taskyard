import type { AddTaskDecisionRequest } from '@taskyard/protocol';
import { addTaskDecision, getDb, removeTaskDecision } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { actorFromWebSession } from '@/lib/people-api';
import { taskErrorResponse } from '@/lib/task-error';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  let body: AddTaskDecisionRequest;
  try {
    body = (await req.json()) as AddTaskDecisionRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!body.choice?.trim()) {
    return jsonError('choice is required');
  }

  const actor = actorFromWebSession(req, body.actor);
  if (!actor.ok) return actor.response;

  const db = getDb();
  try {
    const decision = addTaskDecision(db, id, { ...body, actor: actor.actor });
    if (!decision) return jsonError('Task not found', 404);
    return jsonOk({ decision }, 201);
  } catch (err) {
    return taskErrorResponse(err, 'Failed to add decision');
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const decisionId = new URL(req.url).searchParams.get('decision_id');
  if (!decisionId?.trim()) return jsonError('decision_id is required');
  const actor = actorFromWebSession(req, new URL(req.url).searchParams.get('actor') ?? undefined);
  if (!actor.ok) return actor.response;

  const db = getDb();
  try {
    const task = removeTaskDecision(db, id, decisionId, actor.actor);
    if (!task) return jsonError('Task not found', 404);
    return jsonOk({ task });
  } catch (err) {
    return taskErrorResponse(err, 'Failed to remove decision');
  }
}
