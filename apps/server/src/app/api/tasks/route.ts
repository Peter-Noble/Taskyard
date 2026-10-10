import type { CreateTaskRequest, TaskStatus } from '@taskyard/protocol';
import { createTask, getDb, listTasks } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { taskErrorResponse } from '@/lib/task-error';

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

export async function GET(req: Request) {
  const db = getDb();
  const params = new URL(req.url).searchParams;
  const projectId = params.get('project_id') ?? undefined;
  const statusParam = params.get('status');
  const parentParam = params.has('parent_id') ? params.get('parent_id') : undefined;

  let status: TaskStatus | undefined;
  if (statusParam) {
    if (!TASK_STATUSES.includes(statusParam as TaskStatus)) {
      return jsonError(`Invalid status: ${statusParam}`, 400);
    }
    status = statusParam as TaskStatus;
  }

  const filters: {
    projectId?: string;
    status?: TaskStatus;
    parentId?: string | null;
  } = {};
  if (projectId) filters.projectId = projectId;
  if (status) filters.status = status;
  if (parentParam !== undefined) {
    filters.parentId = parentParam === '' || parentParam === 'null' ? null : parentParam;
  }

  return jsonOk({ tasks: listTasks(db, filters) });
}

export async function POST(req: Request) {
  let body: CreateTaskRequest;
  try {
    body = (await req.json()) as CreateTaskRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!body.title?.trim() || !body.project_id) {
    return jsonError('title and project_id are required');
  }

  const db = getDb();
  try {
    const task = createTask(db, body);
    return jsonOk({ task }, 201);
  } catch (err) {
    return taskErrorResponse(err, 'Failed to create task');
  }
}
