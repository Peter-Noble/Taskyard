import type { AddTaskDependencyRequest } from '@taskyard/protocol';
import { addTaskDependency, getDb, removeTaskDependency } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { taskErrorResponse } from '@/lib/task-error';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  let body: AddTaskDependencyRequest;
  try {
    body = (await req.json()) as AddTaskDependencyRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!body.depends_on?.trim()) return jsonError('depends_on is required');

  const db = getDb();
  try {
    const task = addTaskDependency(db, id, body.depends_on);
    if (!task) return jsonError('Task not found', 404);
    return jsonOk({ task });
  } catch (err) {
    return taskErrorResponse(err, 'Failed to add dependency');
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const dependsOn = new URL(req.url).searchParams.get('depends_on');
  if (!dependsOn?.trim()) return jsonError('depends_on is required');

  const db = getDb();
  try {
    const task = removeTaskDependency(db, id, dependsOn);
    if (!task) return jsonError('Task not found', 404);
    return jsonOk({ task });
  } catch (err) {
    return taskErrorResponse(err, 'Failed to remove dependency');
  }
}
