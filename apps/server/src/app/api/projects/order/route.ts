import type { ReorderProjectsRequest } from '@taskyard/protocol';
import { getDb, ProjectError, reorderProjects } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

export async function POST(req: Request) {
  let body: ReorderProjectsRequest;
  try {
    body = (await req.json()) as ReorderProjectsRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string' || !id.trim())) {
    return jsonError('ids must be a list of project ids');
  }

  const db = getDb();
  try {
    const projects = reorderProjects(db, body.ids);
    return jsonOk({ projects });
  } catch (err) {
    if (err instanceof ProjectError) {
      return jsonError(err.message, 400, { code: 'PROJECT_ERROR' });
    }
    return jsonError(err instanceof Error ? err.message : 'Failed to reorder projects', 500);
  }
}
