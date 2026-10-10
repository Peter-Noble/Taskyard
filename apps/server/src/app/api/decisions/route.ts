import { getDb, listPendingDecisions, listProjectDecisions } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { taskErrorResponse } from '@/lib/task-error';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const projectId = params.get('project_id');
  if (!projectId) return jsonError('project_id is required');

  const db = getDb();
  try {
    const decisions =
      params.get('pending') === '1'
        ? listPendingDecisions(db, projectId)
        : listProjectDecisions(db, projectId);
    return jsonOk({ decisions });
  } catch (err) {
    return taskErrorResponse(err, 'Failed to list decisions');
  }
}
