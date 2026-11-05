import type {
  IdeaDetail,
  IdeaStatus,
  PromoteIdeaResponse,
} from '@taskyard/protocol';
import { actorFromEnv, apiFetch, TaskCliError, writeOutput } from './task-cli.js';

export const IDEA_STATUSES: IdeaStatus[] = ['active', 'archived', 'promoted'];

type Collection = { id: string; name: string; project_ids: string[] };

export async function resolveCollections(values: string[] | undefined): Promise<string[] | undefined> {
  if (!values?.length) return undefined;
  const data = await apiFetch<{ collections: Collection[] }>('/api/collections');
  const byId = new Map(data.collections.map((item) => [item.id, item]));
  return values.map((value) => {
    const direct = byId.get(value);
    if (direct) return direct.id;
    const matches = data.collections.filter((item) => item.name.toLowerCase() === value.toLowerCase());
    if (matches.length !== 1) {
      throw new TaskCliError(1, { error: `Collection not found: ${value}` });
    }
    return matches[0]!.id;
  });
}

function requiredId(id: string | undefined): string {
  const value = id?.trim() || process.env.TASKYARD_IDEA_ID?.trim();
  if (!value) {
    throw new TaskCliError(1, {
      error: 'idea id is required',
      hint: 'Pass an idea id or set TASKYARD_IDEA_ID.',
    });
  }
  return value;
}

export async function cmdIdeaCreate(
  opts: { title: string; description?: string; collection?: string[] },
  pretty: boolean,
): Promise<void> {
  const data = await apiFetch<{ idea: IdeaDetail }>('/api/ideas', {
    method: 'POST',
    body: JSON.stringify({
      title: opts.title,
      description: opts.description,
      collection_ids: (await resolveCollections(opts.collection)) ?? [],
      actor: actorFromEnv(),
    }),
  });
  writeOutput(data, pretty);
}

export async function cmdIdeaList(
  opts: { collection?: string; status?: string },
  pretty: boolean,
): Promise<void> {
  if (opts.status && !IDEA_STATUSES.includes(opts.status as IdeaStatus)) {
    throw new TaskCliError(1, {
      error: `Invalid status: ${opts.status}`,
      hint: `Expected one of: ${IDEA_STATUSES.join(', ')}`,
    });
  }
  const collectionIds = await resolveCollections(opts.collection ? [opts.collection] : undefined);
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (collectionIds?.[0]) params.set('collection_id', collectionIds[0]);
  const query = params.size ? `?${params.toString()}` : '';
  const data = await apiFetch<{ ideas: IdeaDetail[] }>(`/api/ideas${query}`);
  writeOutput(data, pretty);
}

export async function cmdIdeaGet(id: string | undefined, pretty: boolean): Promise<void> {
  const data = await apiFetch<{ idea: IdeaDetail }>(`/api/ideas/${encodeURIComponent(requiredId(id))}`);
  writeOutput(data, pretty);
}

export async function cmdIdeaUpdate(
  id: string,
  opts: { title?: string; description?: string; collection?: string[]; clearCollections?: boolean },
  pretty: boolean,
): Promise<void> {
  const collectionIds = opts.clearCollections ? [] : await resolveCollections(opts.collection);
  const data = await apiFetch<{ idea: IdeaDetail }>(`/api/ideas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: opts.title,
      description: opts.description,
      collection_ids: collectionIds,
      actor: actorFromEnv(),
    }),
  });
  writeOutput(data, pretty);
}

export async function cmdIdeaComment(id: string, text: string, pretty: boolean): Promise<void> {
  const data = await apiFetch(`/api/ideas/${encodeURIComponent(id)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text, actor: actorFromEnv() }),
  });
  writeOutput(data, pretty);
}

export async function cmdIdeaArchive(id: string, restore: boolean, pretty: boolean): Promise<void> {
  const data = await apiFetch<{ idea: IdeaDetail }>(`/api/ideas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: !restore, actor: actorFromEnv() }),
  });
  writeOutput(data, pretty);
}

export async function cmdIdeaPromote(
  id: string,
  opts: { name?: string; repoUrl?: string; defaultBranch?: string },
  pretty: boolean,
): Promise<void> {
  const data = await apiFetch<PromoteIdeaResponse>(`/api/ideas/${encodeURIComponent(id)}/promote`, {
    method: 'POST',
    body: JSON.stringify({
      name: opts.name,
      repo_url: opts.repoUrl,
      default_branch: opts.defaultBranch,
      actor: actorFromEnv(),
    }),
  });
  writeOutput(data, pretty);
}
