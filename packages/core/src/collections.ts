import { collectionProjects, collections, projects, type TaskyardDb } from '@taskyard/db';
import { and, asc, eq, inArray, max } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export class CollectionError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CollectionError';
    this.statusCode = statusCode;
  }
}

export type CollectionRecord = {
  id: string;
  name: string;
  projectIds: string[];
};

function normalizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 40) throw new CollectionError('Collection name must be 1–40 characters.');
  return name;
}

function requireOwned(db: TaskyardDb, personId: string, collectionId: string): typeof collections.$inferSelect {
  const row = db.select().from(collections).where(eq(collections.id, collectionId)).get();
  if (!row || row.personId !== personId) throw new CollectionError('Collection not found.', 404);
  return row;
}

function memberships(db: TaskyardDb, collectionIds: string[]) {
  if (collectionIds.length === 0) return [];
  return db
    .select()
    .from(collectionProjects)
    .where(inArray(collectionProjects.collectionId, collectionIds))
    .orderBy(asc(collectionProjects.sortOrder), asc(collectionProjects.projectId))
    .all();
}

export function listCollections(db: TaskyardDb, personId: string): CollectionRecord[] {
  const rows = db
    .select()
    .from(collections)
    .where(eq(collections.personId, personId))
    .orderBy(asc(collections.createdAt), asc(collections.name))
    .all();
  const links = memberships(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    projectIds: links.filter((link) => link.collectionId === row.id).map((link) => link.projectId),
  }));
}

export function createCollection(db: TaskyardDb, personId: string, nameRaw: string): CollectionRecord {
  const name = normalizeName(nameRaw);
  const taken = db
    .select()
    .from(collections)
    .where(eq(collections.personId, personId))
    .all()
    .some((row) => row.name.toLowerCase() === name.toLowerCase());
  if (taken) throw new CollectionError('You already have a collection with that name.', 409);
  const id = randomUUID();
  db.insert(collections)
    .values({ id, personId, name, createdAt: new Date() })
    .run();
  return { id, name, projectIds: [] };
}

export function deleteCollection(db: TaskyardDb, personId: string, collectionId: string): void {
  const row = requireOwned(db, personId, collectionId);
  db.transaction((tx) => {
    tx.delete(collectionProjects).where(eq(collectionProjects.collectionId, row.id)).run();
    tx.delete(collections).where(eq(collections.id, row.id)).run();
  });
}

export function addProjectToCollection(
  db: TaskyardDb,
  personId: string,
  collectionId: string,
  projectId: string,
): CollectionRecord {
  const row = requireOwned(db, personId, collectionId);
  const project = db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new CollectionError('Project not found.', 404);
  const existing = db
    .select()
    .from(collectionProjects)
    .where(
      and(eq(collectionProjects.collectionId, row.id), eq(collectionProjects.projectId, projectId)),
    )
    .get();
  if (!existing) {
    const maxOrder = db
      .select({ value: max(collectionProjects.sortOrder) })
      .from(collectionProjects)
      .where(eq(collectionProjects.collectionId, row.id))
      .get();
    db.insert(collectionProjects)
      .values({
        collectionId: row.id,
        projectId,
        sortOrder: (maxOrder?.value ?? -1) + 1,
      })
      .run();
  }
  return listCollections(db, personId).find((item) => item.id === row.id)!;
}

export function removeProjectFromCollection(
  db: TaskyardDb,
  personId: string,
  collectionId: string,
  projectId: string,
): CollectionRecord {
  const row = requireOwned(db, personId, collectionId);
  db.delete(collectionProjects)
    .where(
      and(eq(collectionProjects.collectionId, row.id), eq(collectionProjects.projectId, projectId)),
    )
    .run();
  return listCollections(db, personId).find((item) => item.id === row.id)!;
}

export function reorderCollectionProjects(
  db: TaskyardDb,
  personId: string,
  collectionId: string,
  ids: string[],
): CollectionRecord {
  const row = requireOwned(db, personId, collectionId);
  if (ids.length === 0) throw new CollectionError('ids is required');
  if (new Set(ids).size !== ids.length) throw new CollectionError('Duplicate project id in order');
  const members = db
    .select()
    .from(collectionProjects)
    .where(eq(collectionProjects.collectionId, row.id))
    .orderBy(asc(collectionProjects.sortOrder), asc(collectionProjects.projectId))
    .all();
  const known = new Set(members.map((member) => member.projectId));
  for (const id of ids) {
    if (!known.has(id)) throw new CollectionError(`Project not found: ${id}`, 404);
  }
  const moving = new Set(ids);
  const queue = [...ids];
  const next = members.map((member) => (moving.has(member.projectId) ? queue.shift()! : member.projectId));
  // D-005
  db.transaction((tx) => {
    next.forEach((projectId, index) => {
      tx.update(collectionProjects)
        .set({ sortOrder: index })
        .where(
          and(
            eq(collectionProjects.collectionId, row.id),
            eq(collectionProjects.projectId, projectId),
          ),
        )
        .run();
    });
  });
  return listCollections(db, personId).find((item) => item.id === row.id)!;
}
