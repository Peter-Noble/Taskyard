import { eq } from 'drizzle-orm';
import { taskActivity } from '@taskyard/db';
import { createTestDb, type TestDbContext } from '@taskyard/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCollection } from './collections.js';
import {
  addIdeaComment,
  createIdea,
  promoteIdea,
  updateIdea,
} from './ideas.js';
import { createProject } from './projects.js';
import { addTaskComment, addTaskDecision, createTask, updateTask } from './tasks.js';
import { people, projectGuests } from '@taskyard/db';
import { search, searchQueryForFts, SearchError } from './search.js';

function seedPerson(db: TestDbContext['db'], id: string) {
  db.insert(people).values({
    id,
    username: id,
    displayName: id,
    passwordHash: 'test-hash',
    mustChangePassword: false,
    createdAt: new Date(),
  }).run();
}

describe('full-text search', () => {
  let context: TestDbContext;

  beforeEach(() => {
    context = createTestDb();
    seedPerson(context.db, 'owner');
    seedPerson(context.db, 'guest');
    seedPerson(context.db, 'other');
  });

  afterEach(() => context.cleanup());

  it('finds task text, ranks exact ids, respects project scope, and follows edits', () => {
    const project = createProject(context.db, { name: 'Taskyard' });
    const otherProject = createProject(context.db, { name: 'Elsewhere' });
    const task = createTask(context.db, {
      project_id: project.id,
      title: 'App wide search',
      description: 'A performant brief with quixotic language',
    });
    addTaskComment(context.db, task.id, { text: 'A comment containing zebrafish' });
    addTaskDecision(context.db, task.id, {
      choice: 'Use an indexed document',
      why: 'Avoid synchronous scans',
    });
    createTask(context.db, { project_id: otherProject.id, title: 'quixotic elsewhere' });

    expect(search(context.db, {
      query: 'quix',
      projectId: project.id,
    }).results.map((result) => result.id)).toEqual([task.id]);
    expect(search(context.db, {
      query: 'zebrafish',
      projectId: project.id,
    }).results[0]?.snippet.some((part) => part.match && /zebrafish/i.test(part.text))).toBe(true);
    expect(search(context.db, {
      query: 'synchronous',
      projectId: project.id,
    }).results).toHaveLength(1);
    expect(search(context.db, {
      query: 'quixotic',
      allProjects: true,
    }).results).toHaveLength(2);
    expect(search(context.db, {
      query: task.short_id,
      allProjects: true,
    }).results[0]).toMatchObject({ id: task.id, type: 'task', updated_at: task.updated_at });

    updateTask(context.db, task.id, { description: 'Replacement brief', status: 'completed' });
    expect(search(context.db, { query: 'quixotic', projectId: project.id }).results).toHaveLength(0);
    expect(search(context.db, { query: 'replacement', projectId: project.id }).results[0]).toMatchObject({
      status: 'completed',
    });

    context.db.update(taskActivity)
      .set({ payload: JSON.stringify({ text: 'Updated comment vocabulary' }) })
      .where(eq(taskActivity.taskId, task.id))
      .run();
    expect(search(context.db, { query: 'zebrafish', projectId: project.id }).results).toHaveLength(0);
    expect(search(context.db, { query: 'vocabulary', projectId: project.id }).results).toHaveLength(1);
  });

  it('searches readable ideas by collection and includes archived and promoted ideas', () => {
    const collection = createCollection(context.db, 'owner', 'Work');
    const otherCollection = createCollection(context.db, 'owner', 'Personal');
    const idea = createIdea(context.db, 'owner', {
      title: 'Searchable idea',
      description: 'Private collection notes',
      collection_ids: [collection.id],
    });
    addIdeaComment(context.db, idea.id, 'owner', { text: 'Idea comment with moonquakes' });
    createIdea(context.db, 'owner', {
      title: 'Other moonquakes',
      collection_ids: [otherCollection.id],
    });

    expect(search(context.db, {
      query: 'moonquakes',
      type: 'idea',
      personId: 'owner',
      collectionId: collection.id,
    }).results.map((result) => result.id)).toEqual([idea.id]);
    expect(search(context.db, {
      query: 'moonquakes',
      type: 'idea',
      personId: 'owner',
    }).results).toHaveLength(2);
    expect(search(context.db, {
      query: 'moonquakes',
      type: 'idea',
      personId: 'other',
    }).results).toHaveLength(0);

    updateIdea(context.db, idea.id, 'owner', { archived: true });
    expect(search(context.db, {
      query: idea.short_id,
      type: 'idea',
      personId: 'owner',
    }).results[0]).toMatchObject({ status: 'archived' });

    const promoted = promoteIdea(context.db, idea.id, 'owner', { default_branch: 'main' });
    context.db.insert(projectGuests).values({
      projectId: promoted.project.id,
      personId: 'guest',
    }).run();
    expect(search(context.db, {
      query: 'moonquakes',
      type: 'idea',
      personId: 'guest',
    }).results[0]).toMatchObject({ id: idea.id, status: 'promoted' });
  });

  it('combines tasks and ideas and handles query and scope boundaries', () => {
    const project = createProject(context.db, { name: 'Taskyard' });
    const task = createTask(context.db, {
      project_id: project.id,
      title: 'Shared neologism',
      description: '<script>safe text</script>',
    });
    const idea = createIdea(context.db, 'owner', {
      title: 'Shared neologism idea',
      description: 'Find both entities',
    });
    const combined = search(context.db, {
      query: 'neologism',
      type: 'all',
      projectId: project.id,
      personId: 'owner',
    }).results;
    expect(new Set(combined.map((result) => result.id))).toEqual(new Set([task.id, idea.id]));
    expect(search(context.db, { query: '---', projectId: project.id }).results).toEqual([]);
    expect(searchQueryForFts('App-wide search')).toBe('"App"* "wide"* "search"*');
    expect(() => search(context.db, { query: 'task' })).toThrow(SearchError);
    expect(() => search(context.db, {
      query: 'idea',
      type: 'idea',
      personId: 'owner',
      allProjects: true,
    })).toThrow(/only valid for task search/);
  });
});
