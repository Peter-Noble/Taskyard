import type { CreateProjectRequest } from '@taskyard/protocol';
import { createProject, getDb, listProjects, ProjectError } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

export async function GET(req: Request) {
  const db = getDb();
  const includeArchived = new URL(req.url).searchParams.get('include_archived') === '1';
  return jsonOk({ projects: listProjects(db, { includeArchived }) });
}

export async function POST(req: Request) {
  let body: CreateProjectRequest;
  try {
    body = (await req.json()) as CreateProjectRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!body.name?.trim()) {
    return jsonError('name is required');
  }

  const db = getDb();
  try {
    const project = createProject(db, body);
    return jsonOk({ project }, 201);
  } catch (err) {
    if (err instanceof ProjectError) {
      return jsonError(err.message, 400, { code: 'PROJECT_ERROR' });
    }
    return jsonError(err instanceof Error ? err.message : 'Failed to create project', 500);
  }
}
