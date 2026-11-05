import type {
  SearchResponse,
  SearchResult,
  SearchType,
  TaskStatus,
  IdeaStatus,
} from '@taskyard/protocol';
import type { TaskyardDb } from '@taskyard/db';
import { sql, type SQL } from 'drizzle-orm';

export class SearchError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'SearchError';
    this.statusCode = statusCode;
  }
}

export type SearchOptions = {
  query: string;
  type?: SearchType;
  projectId?: string;
  allProjects?: boolean;
  collectionId?: string;
  personId?: string;
  limit?: number;
};

type RankedResult = {
  result: SearchResult;
  exact: number;
  rank: number;
};

type RawSearchRow = {
  id: string;
  short_id: string;
  title: string;
  status: string;
  updated_at: number | null;
  snippet: string;
  exact: number;
  rank: number;
  project_id?: string;
  project_name?: string;
  promoted_project_id?: string | null;
  archived_at?: number | null;
};

const MATCH_START = '\u0001';
const MATCH_END = '\u0002';

export function searchQueryForFts(query: string): string | null {
  const tokens = query.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu)?.slice(0, 12) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token}"*`).join(' ');
}

function snippetParts(raw: string) {
  const parts: Array<{ text: string; match: boolean }> = [];
  let match = false;
  for (const text of raw.split(/([\u0001\u0002])/)) {
    if (text === MATCH_START) {
      match = true;
    } else if (text === MATCH_END) {
      match = false;
    } else if (text) {
      parts.push({ text, match });
    }
  }
  return parts;
}

function isoTimestamp(value: number | null): string {
  return new Date((value ?? 0) * 1000).toISOString();
}

function compareResults(a: RankedResult, b: RankedResult): number {
  if (a.exact !== b.exact) return b.exact - a.exact;
  if (a.rank !== b.rank) return a.rank - b.rank;
  return b.result.updated_at.localeCompare(a.result.updated_at);
}

function taskSearch(
  db: TaskyardDb,
  query: string,
  matchQuery: string,
  projectId: string | undefined,
  allProjects: boolean,
  limit: number,
): RankedResult[] {
  if (!allProjects && !projectId) {
    throw new SearchError('project_id is required for task search unless all_projects is set');
  }
  const projectScope: SQL = allProjects
    ? sql.empty()
    : sql`AND tasks.project_id = ${projectId}`;
  const rows = db.all<RawSearchRow>(sql`
    SELECT
      tasks.id,
      tasks.short_id,
      tasks.title,
      tasks.status,
      tasks.project_id,
      projects.name AS project_name,
      tasks.updated_at,
      snippet(task_search, -1, char(1), char(2), ' … ', 24) AS snippet,
      CASE WHEN upper(tasks.short_id) = upper(${query}) THEN 1 ELSE 0 END AS exact,
      bm25(task_search, 10.0, 6.0, 2.0, 1.0, 1.0) AS rank
    FROM task_search
    INNER JOIN tasks ON tasks.id = task_search.task_id
    INNER JOIN projects ON projects.id = tasks.project_id
    WHERE task_search MATCH ${matchQuery}
    ${projectScope}
    ORDER BY exact DESC, rank ASC, tasks.updated_at DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    exact: row.exact,
    rank: row.rank,
    result: {
      type: 'task',
      id: row.id,
      short_id: row.short_id,
      title: row.title,
      status: row.status as TaskStatus,
      project_id: row.project_id!,
      project_name: row.project_name!,
      updated_at: isoTimestamp(row.updated_at),
      snippet: snippetParts(row.snippet),
    },
  }));
}

function ideaSearch(
  db: TaskyardDb,
  query: string,
  matchQuery: string,
  personId: string,
  collectionId: string | undefined,
  limit: number,
): RankedResult[] {
  const collectionScope: SQL = collectionId
    ? sql`AND EXISTS (
        SELECT 1
        FROM collection_ideas AS search_collection_idea
        INNER JOIN collections AS search_collection
          ON search_collection.id = search_collection_idea.collection_id
        WHERE search_collection_idea.idea_id = ideas.id
          AND search_collection_idea.collection_id = ${collectionId}
          AND search_collection.person_id = ${personId}
      )`
    : sql.empty();
  const rows = db.all<RawSearchRow>(sql`
    SELECT
      ideas.id,
      ideas.short_id,
      ideas.title,
      ideas.archived_at,
      ideas.promoted_project_id,
      ideas.updated_at,
      snippet(idea_search, -1, char(1), char(2), ' … ', 24) AS snippet,
      CASE WHEN upper(ideas.short_id) = upper(${query}) THEN 1 ELSE 0 END AS exact,
      bm25(idea_search, 10.0, 6.0, 2.0, 1.0) AS rank
    FROM idea_search
    INNER JOIN ideas ON ideas.id = idea_search.idea_id
    WHERE idea_search MATCH ${matchQuery}
      AND (
        ideas.owner_id = ${personId}
        OR EXISTS (
          SELECT 1 FROM project_guests AS search_guest
          WHERE search_guest.project_id = ideas.promoted_project_id
            AND search_guest.person_id = ${personId}
        )
      )
    ${collectionScope}
    ORDER BY exact DESC, rank ASC, ideas.updated_at DESC
    LIMIT ${limit}
  `);
  return rows.map((row) => ({
    exact: row.exact,
    rank: row.rank,
    result: {
      type: 'idea',
      id: row.id,
      short_id: row.short_id,
      title: row.title,
      status: (row.promoted_project_id
        ? 'promoted'
        : row.archived_at
          ? 'archived'
          : 'active') as IdeaStatus,
      promoted_project_id: row.promoted_project_id ?? null,
      updated_at: isoTimestamp(row.updated_at),
      snippet: snippetParts(row.snippet),
    },
  }));
}

export function search(db: TaskyardDb, options: SearchOptions): SearchResponse {
  const query = options.query.trim();
  if (!query) return { results: [] };
  if (query.length > 200) throw new SearchError('Search query must be 200 characters or fewer');
  if (options.allProjects && options.projectId) {
    throw new SearchError('project_id and all_projects cannot be used together');
  }
  const type = options.type ?? 'task';
  if (type === 'task' && options.collectionId) {
    throw new SearchError('collection_id is only valid for idea search');
  }
  if (type === 'idea' && (options.projectId || options.allProjects)) {
    throw new SearchError('Project scope is only valid for task search');
  }
  if ((type === 'idea' || type === 'all') && !options.personId) {
    throw new SearchError('personId is required for idea search', 401);
  }
  const matchQuery = searchQueryForFts(query);
  if (!matchQuery) return { results: [] };
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit ?? 20)));
  const results: RankedResult[] = [];
  if (type === 'task' || type === 'all') {
    results.push(
      ...taskSearch(db, query, matchQuery, options.projectId, Boolean(options.allProjects), limit),
    );
  }
  if (type === 'idea' || type === 'all') {
    results.push(
      ...ideaSearch(db, query, matchQuery, options.personId!, options.collectionId, limit),
    );
  }
  return {
    results: results.sort(compareResults).slice(0, limit).map((entry) => entry.result),
  };
}
