import type { CreateProjectRequest } from '@taskyard/protocol';
import { createProject, getDb, listProjects, ProjectError, addProjectToCollection } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireFullSession } from '@/lib/people-api';
import { ACTIVE_COLLECTION_COOKIE, readRequestCookie } from '@/lib/active-collection';

export async function GET(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;

  const db = getDb();
  const includeArchived = new URL(req.url).searchParams.get('include_archived') === '1';
  return jsonOk({ projects: listProjects(db, { includeArchived }) });
}

export async function POST(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;

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
    const collectionId = readRequestCookie(req.headers.get('cookie'), ACTIVE_COLLECTION_COOKIE);
    if (collectionId) {
      try {
        addProjectToCollection(db, gate.person.id, collectionId, project.id);
      } catch {
        // A stale collection cookie must not block creating the project.
      }
    }
    return jsonOk({ project }, 201);
  } catch (err) {
    if (err instanceof ProjectError) {
      return jsonError(err.message, 400, { code: 'PROJECT_ERROR' });
    }
    return jsonError(err instanceof Error ? err.message : 'Failed to create project', 500);
  }
}
