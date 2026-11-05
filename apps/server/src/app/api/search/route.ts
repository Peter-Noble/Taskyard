import type { SearchType } from '@taskyard/protocol';
import { getDb, search, SearchError } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireIdeaPerson } from '@/lib/ideas-api';

const SEARCH_TYPES: SearchType[] = ['task', 'idea', 'all'];

export async function GET(req: Request) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  const params = new URL(req.url).searchParams;
  const query = params.get('q')?.trim() ?? '';
  if (!query) return jsonError('q is required');
  if (query.length > 200) return jsonError('q must be 200 characters or fewer');

  const type = (params.get('type') ?? 'task') as SearchType;
  if (!SEARCH_TYPES.includes(type)) return jsonError(`Invalid search type: ${type}`);
  const limitParam = params.get('limit');
  const limit = limitParam === null ? 20 : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return jsonError('limit must be an integer between 1 and 100');
  }
  const projectId = params.get('project_id')?.trim() || undefined;
  const allProjects = params.get('all_projects') === '1';
  const collectionId = params.get('collection_id')?.trim() || undefined;
  if (projectId && allProjects) {
    return jsonError('project_id and all_projects cannot be used together');
  }
  if ((type === 'task' || type === 'all') && !projectId && !allProjects) {
    return jsonError('project_id is required unless all_projects=1');
  }
  if (type === 'task' && collectionId) {
    return jsonError('collection_id is only valid for idea search');
  }
  if (type === 'idea' && (projectId || allProjects)) {
    return jsonError('Project scope is only valid for task search');
  }

  try {
    return jsonOk(
      search(getDb(), {
        query,
        type,
        projectId,
        allProjects,
        collectionId,
        personId: gate.person.id,
        limit,
      }),
    );
  } catch (err) {
    if (err instanceof SearchError) return jsonError(err.message, err.statusCode);
    return jsonError(err instanceof Error ? err.message : 'Search failed', 500);
  }
}
