import { getDb, nextTask, TaskError } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { taskErrorResponse } from '@/lib/task-error';

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get('project_id');
  if (!projectId) return jsonError('project_id is required');

  const db = getDb();
  try {
    const task = nextTask(db, projectId);
    return jsonOk({ task });
  } catch (err) {
    if (err instanceof TaskError) return taskErrorResponse(err, 'Failed to find next task');
    return taskErrorResponse(err, 'Failed to find next task');
  }
}
