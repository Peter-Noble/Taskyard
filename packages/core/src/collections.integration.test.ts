import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { projects } from '@taskyard/db';
import { createTestDb } from '@taskyard/test-utils';
import {
  addProjectToCollection,
  createCollection,
  deleteCollection,
  listCollections,
  reorderCollectionProjects,
} from './collections.js';
import { createFirstPerson, createPerson } from './people.js';
import { createProject } from './projects.js';

describe('collections', () => {
  it('lets one project sit in two collections without changing server-wide order', async () => {
    const ctx = createTestDb();
    try {
      const person = await createFirstPerson(ctx.db, {
        username: 'peter',
        displayName: 'Peter',
        password: 'first-password',
      });
      const alpha = createProject(ctx.db, { name: 'Alpha' });
      const beta = createProject(ctx.db, { name: 'Beta' });
      const before = ctx.db.select().from(projects).all().map((row) => [row.id, row.sortOrder]);

      const work = createCollection(ctx.db, person.id, 'Work');
      const personal = createCollection(ctx.db, person.id, 'Personal');
      addProjectToCollection(ctx.db, person.id, work.id, alpha.id);
      addProjectToCollection(ctx.db, person.id, work.id, beta.id);
      addProjectToCollection(ctx.db, person.id, personal.id, beta.id);

      const listed = listCollections(ctx.db, person.id);
      expect(listed.find((item) => item.name === 'Work')?.projectIds).toEqual([alpha.id, beta.id]);
      expect(listed.find((item) => item.name === 'Personal')?.projectIds).toEqual([beta.id]);

      reorderCollectionProjects(ctx.db, person.id, work.id, [beta.id, alpha.id]);
      expect(listCollections(ctx.db, person.id).find((item) => item.id === work.id)?.projectIds).toEqual([
        beta.id,
        alpha.id,
      ]);
      const after = ctx.db.select().from(projects).all().map((row) => [row.id, row.sortOrder]);
      expect(after).toEqual(before);

      const other = await createPerson(ctx.db, { username: 'sam', displayName: 'Sam' });
      expect(listCollections(ctx.db, other.person.id)).toEqual([]);

      deleteCollection(ctx.db, person.id, personal.id);
      expect(listCollections(ctx.db, person.id).map((item) => item.name)).toEqual(['Work']);
    } finally {
      ctx.cleanup();
    }
  });

  it('keeps project rows readable by id after a collection filter would hide them', () => {
    const ctx = createTestDb();
    try {
      const alpha = createProject(ctx.db, { name: 'Alpha' });
      expect(ctx.db.select().from(projects).where(eq(projects.id, alpha.id)).get()?.name).toBe('Alpha');
    } finally {
      ctx.cleanup();
    }
  });
});
