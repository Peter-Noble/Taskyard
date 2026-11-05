import type { SearchResponse, SearchType } from '@taskyard/protocol';
import { resolveCollections } from './idea-cli.js';
import {
  apiFetch,
  requireProjectId,
  TaskCliError,
  writeOutput,
} from './task-cli.js';

export type SearchCommandOptions = {
  type?: string;
  project?: string;
  allProjects?: boolean;
  collection?: string;
  limit?: string;
};

export async function cmdSearch(
  query: string,
  opts: SearchCommandOptions,
  pretty: boolean,
): Promise<void> {
  const type = (opts.type ?? 'task') as SearchType;
  if (!['task', 'idea', 'all'].includes(type)) {
    throw new TaskCliError(1, {
      error: `Invalid search type: ${opts.type}`,
      hint: 'Expected one of: task, idea, all.',
    });
  }
  const limit = Number(opts.limit ?? '20');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TaskCliError(1, { error: 'limit must be an integer between 1 and 100' });
  }
  if (opts.project && opts.allProjects) {
    throw new TaskCliError(1, { error: '--project and --all-projects cannot be used together' });
  }
  if (type === 'task' && opts.collection) {
    throw new TaskCliError(1, { error: '--collection requires --type idea or --type all' });
  }
  if (type === 'idea' && (opts.project || opts.allProjects)) {
    throw new TaskCliError(1, { error: 'Project scope is only valid for task search' });
  }

  const params = new URLSearchParams({ q: query, type, limit: String(limit) });
  if (type === 'task' || type === 'all') {
    if (opts.allProjects) params.set('all_projects', '1');
    else params.set('project_id', requireProjectId(opts.project));
  }
  if ((type === 'idea' || type === 'all') && opts.collection) {
    const ids = await resolveCollections([opts.collection]);
    if (ids?.[0]) params.set('collection_id', ids[0]);
  }

  const data = await apiFetch<SearchResponse>(`/api/search?${params.toString()}`);
  if (!pretty) {
    writeOutput(data, false);
    return;
  }
  if (data.results.length === 0) {
    process.stdout.write('No results.\n');
    return;
  }
  const output = data.results.map((result) => {
    const scope = result.type === 'task' ? `\t${result.project_name}` : '';
    const snippet = result.snippet.map((part) => part.text).join('');
    return `${result.short_id}\t${result.type}\t${result.status}${scope}\t${result.title}\n  ${snippet}`;
  });
  process.stdout.write(`${output.join('\n')}\n`);
}
