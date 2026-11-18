import type { AddTaskDecisionRequest } from '@taskyard/protocol';
import { addTaskDecision, getDb, removeTaskDecision } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireFullSession, sessionActor } from '@/lib/people-api';
import { taskErrorResponse } from '@/lib/task-error';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;

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

  const db = getDb();
  try {
    const decision = addTaskDecision(db, id, { ...body, actor: sessionActor(gate, body.actor) });
    if (!decision) return jsonError('Task not found', 404);
    return jsonOk({ decision }, 201);
  } catch (err) {
    return taskErrorResponse(err, 'Failed to add decision');
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const decisionId = searchParams.get('decision_id');
  if (!decisionId?.trim()) return jsonError('decision_id is required');

  const db = getDb();
  try {
    const actor = sessionActor(gate, searchParams.get('actor') ?? undefined);
    const task = removeTaskDecision(db, id, decisionId, actor);
    if (!task) return jsonError('Task not found', 404);
    return jsonOk({ task });
  } catch (err) {
    return taskErrorResponse(err, 'Failed to remove decision');
  }
}
