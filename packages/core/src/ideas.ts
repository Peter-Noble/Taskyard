import {
  collectionIdeas,
  collectionProjects,
  collections,
  ideaActivity,
  ideas,
  projectGuests,
  threads,
  type TaskyardDb,
} from '@taskyard/db';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type {
  AddIdeaCommentRequest,
  CreateIdeaRequest,
  Idea,
  IdeaActivity,
  IdeaCollection,
  IdeaDetail,
  IdeaStatus,
  PromoteIdeaRequest,
  UpdateIdeaRequest,
} from '@taskyard/protocol';
import { createProject, listProjects } from './projects.js';

export class IdeaError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'IdeaError';
    this.statusCode = statusCode;
  }
}

type IdeaRow = typeof ideas.$inferSelect;
type IdeaActivityRow = typeof ideaActivity.$inferSelect;
type IdeaWriter = Pick<TaskyardDb, 'select' | 'insert' | 'update' | 'delete'>;

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function ideaStatus(row: IdeaRow): IdeaStatus {
  if (row.promotedProjectId) return 'promoted';
  return row.archivedAt ? 'archived' : 'active';
}

function getIdeaRow(db: TaskyardDb, idOrShort: string): IdeaRow | null {
  const key = idOrShort.trim();
  const byId = db.select().from(ideas).where(eq(ideas.id, key)).get();
  if (byId) return byId;
  return db
    .select()
    .from(ideas)
    .where(eq(ideas.shortId, key.toUpperCase()))
    .get() ?? null;
}

function allocateShortId(db: IdeaWriter): string {
  const rows = db.select({ shortId: ideas.shortId }).from(ideas).all();
  const highest = rows.reduce((value, row) => {
    const match = /^IDEA-(\d+)$/.exec(row.shortId);
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return `IDEA-${highest + 1}`;
}

function recordChange(
  db: IdeaWriter,
  ideaId: string,
  actor: string,
  summary: string,
  detail?: string,
  timestamp = new Date(),
) {
  db.insert(ideaActivity)
    .values({
      ideaId,
      kind: 'change',
      actor: actor.trim() || 'user',
      payload: JSON.stringify(detail !== undefined ? { summary, detail } : { summary }),
      timestamp,
    })
    .run();
}

function assertCollectionIds(db: IdeaWriter, personId: string, ids: string[] | undefined): string[] {
  const unique = [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return unique;
  const rows = db
    .select({ id: collections.id, personId: collections.personId })
    .from(collections)
    .where(inArray(collections.id, unique))
    .all();
  if (rows.length !== unique.length || rows.some((row) => row.personId !== personId)) {
    throw new IdeaError('Collections must belong to the idea owner.', 403);
  }
  return unique;
}

function replaceCollections(db: IdeaWriter, ideaId: string, collectionIds: string[]) {
  db.delete(collectionIdeas).where(eq(collectionIdeas.ideaId, ideaId)).run();
  collectionIds.forEach((collectionId, index) => {
    db.insert(collectionIdeas).values({ collectionId, ideaId, sortOrder: index }).run();
  });
}

function ideaCollections(db: TaskyardDb, ideaIds: string[]): Map<string, IdeaCollection[]> {
  const result = new Map<string, IdeaCollection[]>();
  if (ideaIds.length === 0) return result;
  const rows = db
    .select({
      ideaId: collectionIdeas.ideaId,
      id: collections.id,
      name: collections.name,
    })
    .from(collectionIdeas)
    .innerJoin(collections, eq(collections.id, collectionIdeas.collectionId))
    .where(inArray(collectionIdeas.ideaId, ideaIds))
    .orderBy(asc(collectionIdeas.sortOrder), asc(collections.name))
    .all();
  for (const row of rows) {
    const entries = result.get(row.ideaId) ?? [];
    entries.push({ id: row.id, name: row.name });
    result.set(row.ideaId, entries);
  }
  return result;
}

function formatIdea(
  row: IdeaRow,
  collectionsForIdea: IdeaCollection[],
  canWrite: boolean,
): Idea {
  return {
    id: row.id,
    short_id: row.shortId,
    owner_id: row.ownerId,
    title: row.title,
    description: row.description ?? '',
    status: ideaStatus(row),
    archived_at: iso(row.archivedAt),
    promoted_project_id: row.promotedProjectId,
    collections: collectionsForIdea,
    can_write: canWrite,
    created_at: iso(row.createdAt) ?? new Date().toISOString(),
    updated_at: iso(row.updatedAt) ?? new Date().toISOString(),
  };
}

function formatActivity(row: IdeaActivityRow): IdeaActivity {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  const created_at = iso(row.timestamp) ?? new Date().toISOString();
  if (row.kind === 'comment') {
    return {
      type: 'comment',
      actor: row.actor,
      text: typeof payload.text === 'string' ? payload.text : '',
      created_at,
    };
  }
  const detail = typeof payload.detail === 'string' ? payload.detail : undefined;
  return {
    type: 'change',
    actor: row.actor,
    summary: typeof payload.summary === 'string' ? payload.summary : '',
    ...(detail !== undefined ? { detail } : {}),
    created_at,
  };
}

function canReadIdea(db: TaskyardDb, row: IdeaRow, personId: string): boolean {
  if (row.ownerId === personId) return true;
  if (!row.promotedProjectId) return false;
  return Boolean(
    db
      .select({ personId: projectGuests.personId })
      .from(projectGuests)
      .where(
        and(
          eq(projectGuests.projectId, row.promotedProjectId),
          eq(projectGuests.personId, personId),
        ),
      )
      .get(),
  );
}

export function canReadIdeaId(db: TaskyardDb, id: string, personId: string): boolean {
  const row = getIdeaRow(db, id);
  return Boolean(row && canReadIdea(db, row, personId));
}

function requireOwnedIdea(db: TaskyardDb, id: string, personId: string): IdeaRow {
  const row = getIdeaRow(db, id);
  if (!row || row.ownerId !== personId) throw new IdeaError('Idea not found.', 404);
  return row;
}

function requireActiveIdea(db: TaskyardDb, id: string, personId: string): IdeaRow {
  const row = requireOwnedIdea(db, id, personId);
  if (row.promotedProjectId) throw new IdeaError('A promoted idea is read-only.', 409);
  return row;
}

export function listIdeas(
  db: TaskyardDb,
  personId: string,
  filters?: { collectionId?: string; status?: IdeaStatus },
): Idea[] {
  const rows = db
    .select()
    .from(ideas)
    .where(eq(ideas.ownerId, personId))
    .orderBy(desc(ideas.updatedAt))
    .all();
  const collectionsByIdea = ideaCollections(db, rows.map((row) => row.id));
  return rows
    .filter((row) => !filters?.status || ideaStatus(row) === filters.status)
    .filter((row) =>
      filters?.collectionId
        ? (collectionsByIdea.get(row.id) ?? []).some((item) => item.id === filters.collectionId)
        : true,
    )
    .map((row) =>
      formatIdea(row, collectionsByIdea.get(row.id) ?? [], ideaStatus(row) !== 'promoted'),
    );
}

// D-011
export function getIdeaDetail(db: TaskyardDb, id: string, personId: string): IdeaDetail | null {
  const row = getIdeaRow(db, id);
  if (!row || !canReadIdea(db, row, personId)) return null;
  const owner = row.ownerId === personId;
  const collectionsByIdea = owner ? ideaCollections(db, [row.id]) : new Map<string, IdeaCollection[]>();
  const activity = db
    .select()
    .from(ideaActivity)
    .where(eq(ideaActivity.ideaId, row.id))
    .orderBy(asc(ideaActivity.timestamp), asc(ideaActivity.id))
    .all()
    .map(formatActivity);
  return {
    ...formatIdea(
      row,
      collectionsByIdea.get(row.id) ?? [],
      owner && ideaStatus(row) !== 'promoted',
    ),
    activity,
  };
}

export function getOwnedIdeaDetail(db: TaskyardDb, id: string, personId: string): IdeaDetail {
  const row = requireOwnedIdea(db, id, personId);
  return getIdeaDetail(db, row.id, personId)!;
}

export function createIdea(
  db: TaskyardDb,
  personId: string,
  req: CreateIdeaRequest,
  actor = 'user',
): IdeaDetail {
  const title = req.title?.trim();
  if (!title) throw new IdeaError('title is required');
  const collectionIds = assertCollectionIds(db, personId, req.collection_ids);
  const description = req.description?.trim() ?? '';
  const id = randomUUID();
  const now = new Date();
  db.transaction((tx) => {
    const shortId = allocateShortId(tx);
    tx.insert(ideas)
      .values({ id, shortId, ownerId: personId, title, description, createdAt: now, updatedAt: now })
      .run();
    replaceCollections(tx, id, collectionIds);
    recordChange(tx, id, actor, 'created the idea', undefined, now);
    if (description) recordChange(tx, id, actor, 'set the brief', description, now);
  });
  return getOwnedIdeaDetail(db, id, personId);
}

export function updateIdea(
  db: TaskyardDb,
  id: string,
  personId: string,
  req: UpdateIdeaRequest,
  actor = 'user',
): IdeaDetail {
  const existing = requireActiveIdea(db, id, personId);
  const title = req.title === undefined ? existing.title : req.title.trim();
  if (!title) throw new IdeaError('title is required');
  const description = req.description === undefined ? existing.description : req.description.trim();
  const collectionIds = req.collection_ids === undefined
    ? null
    : assertCollectionIds(db, personId, req.collection_ids);
  const who = req.actor?.trim() || actor;
  const now = new Date();

  db.transaction((tx) => {
    const values: Partial<typeof ideas.$inferInsert> = { updatedAt: now };
    if (title !== existing.title) {
      values.title = title;
      recordChange(tx, existing.id, who, 'updated the title', title, now);
    }
    if (description !== existing.description) {
      values.description = description;
      recordChange(tx, existing.id, who, 'updated the brief', description, now);
    }
    if (collectionIds) {
      replaceCollections(tx, existing.id, collectionIds);
      recordChange(tx, existing.id, who, 'updated collections', undefined, now);
    }
    if (req.archived !== undefined) {
      const archivedAt = req.archived ? existing.archivedAt ?? now : null;
      if (Boolean(archivedAt) !== Boolean(existing.archivedAt)) {
        values.archivedAt = archivedAt;
        recordChange(tx, existing.id, who, req.archived ? 'archived the idea' : 'restored the idea', undefined, now);
      }
    }
    tx.update(ideas).set(values).where(eq(ideas.id, existing.id)).run();
  });
  return getOwnedIdeaDetail(db, existing.id, personId);
}

export function addIdeaComment(
  db: TaskyardDb,
  id: string,
  personId: string,
  req: AddIdeaCommentRequest,
): IdeaActivity {
  const existing = requireActiveIdea(db, id, personId);
  const text = req.text.trim();
  if (!text) throw new IdeaError('text is required');
  const actor = req.actor?.trim() || 'user';
  const now = new Date();
  const inserted = db
    .insert(ideaActivity)
    .values({ ideaId: existing.id, kind: 'comment', actor, payload: JSON.stringify({ text }), timestamp: now })
    .returning()
    .get();
  db.update(ideas).set({ updatedAt: now }).where(eq(ideas.id, existing.id)).run();
  return formatActivity(inserted!);
}

// D-009
export function promoteIdea(
  db: TaskyardDb,
  id: string,
  personId: string,
  req: PromoteIdeaRequest,
  actor = 'user',
) {
  const existing = requireOwnedIdea(db, id, personId);
  if (existing.promotedProjectId) {
    const project = listProjects(db, { includeArchived: true }).find(
      (item) => item.id === existing.promotedProjectId,
    );
    if (!project) throw new IdeaError('Promoted project not found.', 500);
    return { idea: getOwnedIdeaDetail(db, existing.id, personId), project };
  }
  const collectionIds = assertCollectionIds(
    db,
    personId,
    ideaCollections(db, [existing.id]).get(existing.id)?.map((item) => item.id),
  );
  const who = req.actor?.trim() || actor;
  const now = new Date();

  const project = db.transaction((tx) => {
    const created = createProject(tx as unknown as TaskyardDb, {
      name: req.name?.trim() || existing.title,
      repo_url: req.repo_url,
      default_branch: req.default_branch,
    });
    collectionIds.forEach((collectionId, index) => {
      tx.insert(collectionProjects).values({ collectionId, projectId: created.id, sortOrder: index }).run();
    });
    tx.update(ideas)
      .set({ promotedProjectId: created.id, archivedAt: null, updatedAt: now })
      .where(eq(ideas.id, existing.id))
      .run();
    tx.update(threads).set({ projectId: created.id }).where(eq(threads.ideaId, existing.id)).run();
    recordChange(tx, existing.id, who, 'promoted the idea to a project', created.id, now);
    return created;
  });
  return { idea: getOwnedIdeaDetail(db, existing.id, personId), project };
}
