import type { MarkDecisionsExportedRequest } from '@taskyard/protocol';
import { getDb, markDecisionsExported } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { taskErrorResponse } from '@/lib/task-error';

export async function POST(req: Request) {
  let body: MarkDecisionsExportedRequest;
  try {
    body = (await req.json()) as MarkDecisionsExportedRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!body.project_id || !Array.isArray(body.ids)) {
    return jsonError('project_id and ids are required');
  }

  const db = getDb();
  try {
    const pending = markDecisionsExported(db, body.project_id, body.ids);
    return jsonOk({ pending });
  } catch (err) {
    return taskErrorResponse(err, 'Failed to mark decisions exported');
  }
}
