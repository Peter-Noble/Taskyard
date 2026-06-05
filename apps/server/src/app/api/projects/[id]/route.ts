import type { UpdateProjectRequest } from '@taskyard/protocol';
import { getDb, ProjectError, updateProject } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: UpdateProjectRequest;
  try {
    body = (await req.json()) as UpdateProjectRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  const db = getDb();
  try {
    const project = updateProject(db, id, body);
    if (!project) return jsonError('Project not found', 404);
    return jsonOk({ project });
  } catch (err) {
    if (err instanceof ProjectError) {
      return jsonError(err.message, 400, { code: 'PROJECT_ERROR' });
    }
    return jsonError(err instanceof Error ? err.message : 'Failed to update project', 500);
  }
}
