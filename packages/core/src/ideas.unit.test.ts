import { collectionProjects, people, projectGuests, tasks, threads } from '@taskyard/db';
import { createTestDb, type TestDbContext } from '@taskyard/test-utils';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCollection } from './collections.js';
import {
  addIdeaComment,
  createIdea,
  getIdeaDetail,
  listIdeas,
  promoteIdea,
  updateIdea,
} from './ideas.js';
import { createProject } from './projects.js';
import { canReadThread } from './threads.js';

function seedPerson(db: TestDbContext['db'], id: string, username: string) {
  db.insert(people)
    .values({
      id,
      username,
      displayName: username,
      passwordHash: 'test-hash',
      mustChangePassword: false,
      createdAt: new Date(),
    })
    .run();
}

describe('project ideas', () => {
  let context: TestDbContext;

  beforeEach(() => {
    context = createTestDb();
    seedPerson(context.db, 'person-owner', 'owner');
    seedPerson(context.db, 'person-guest', 'guest');
    seedPerson(context.db, 'person-other', 'other');
  });

  afterEach(() => context.cleanup());

  it('keeps ideas private, tracks history, and filters by collection', () => {
    const collection = createCollection(context.db, 'person-owner', 'Work');
    const idea = createIdea(
      context.db,
      'person-owner',
      { title: 'Idea inbox', description: 'Capture projects early.', collection_ids: [collection.id] },
      'Owner',
    );
    addIdeaComment(context.db, idea.id, 'person-owner', { text: 'Discuss this.', actor: 'Owner' });
    const updated = updateIdea(
      context.db,
      idea.short_id,
      'person-owner',
      { title: 'Project idea inbox' },
      'Owner',
    );

    expect(updated.short_id).toBe('IDEA-1');
    expect(updated.collections).toEqual([{ id: collection.id, name: 'Work' }]);
    expect(updated.activity.map((item) => item.type)).toEqual(['change', 'change', 'comment', 'change']);
    expect(listIdeas(context.db, 'person-owner', { collectionId: collection.id })).toHaveLength(1);
    expect(listIdeas(context.db, 'person-other')).toHaveLength(0);
    expect(getIdeaDetail(context.db, idea.id, 'person-other')).toBeNull();
  });

  it('promotes atomically, preserves history, and gives guests a redacted read view', () => {
    const collection = createCollection(context.db, 'person-owner', 'Work');
    const idea = createIdea(
      context.db,
      'person-owner',
      { title: 'Idea inbox', description: 'Capture projects early.', collection_ids: [collection.id] },
      'Owner',
    );
    addIdeaComment(context.db, idea.id, 'person-owner', { text: 'Worth doing.', actor: 'Owner' });
    context.db.insert(threads)
      .values({ id: 'idea-thread', ideaId: idea.id, agentType: 'stub', branch: '', prompt: 'Discuss' })
      .run();
    expect(canReadThread(context.db, 'idea-thread', 'person-owner')).toBe(true);
    expect(canReadThread(context.db, 'idea-thread', 'person-guest')).toBe(false);

    const promoted = promoteIdea(
      context.db,
      idea.id,
      'person-owner',
      { default_branch: 'main', actor: 'agent:abc' },
      'agent:abc',
    );

    expect(promoted.project.name).toBe('Idea inbox');
    expect(promoted.idea.status).toBe('promoted');
    expect(promoted.idea.promoted_project_id).toBe(promoted.project.id);
    expect(promoted.idea.can_write).toBe(false);
    expect(promoted.idea.activity.at(-1)).toMatchObject({
      type: 'change',
      actor: 'agent:abc',
      summary: 'promoted the idea to a project',
    });
    expect(context.db.select().from(tasks).where(eq(tasks.projectId, promoted.project.id)).all()).toHaveLength(0);
    expect(
      context.db
        .select()
        .from(collectionProjects)
        .where(eq(collectionProjects.projectId, promoted.project.id))
        .all(),
    ).toHaveLength(1);

    context.db.insert(projectGuests)
      .values({ projectId: promoted.project.id, personId: 'person-guest' })
      .run();
    const guestView = getIdeaDetail(context.db, idea.id, 'person-guest');
    expect(guestView?.description).toBe('Capture projects early.');
    expect(guestView?.collections).toEqual([]);
    expect(guestView?.can_write).toBe(false);
    expect(getIdeaDetail(context.db, idea.id, 'person-other')).toBeNull();
    expect(() => updateIdea(context.db, idea.id, 'person-owner', { title: 'Changed' })).toThrow(
      'A promoted idea is read-only.',
    );
    expect(promoteIdea(context.db, idea.id, 'person-owner', {}).project.id).toBe(promoted.project.id);
  });

  it('leaves the idea unchanged when project creation fails', () => {
    createProject(context.db, { name: 'Taken' });
    const idea = createIdea(context.db, 'person-owner', { title: 'Taken', description: 'Keep me.' });

    expect(() => promoteIdea(context.db, idea.id, 'person-owner', {})).toThrow(
      'Project name already in use: Taken',
    );
    const current = getIdeaDetail(context.db, idea.id, 'person-owner');
    expect(current?.status).toBe('active');
    expect(current?.promoted_project_id).toBeNull();
    expect(current?.description).toBe('Keep me.');
  });
});
