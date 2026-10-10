import { describe, expect, it } from 'vitest';
import { createTestDb } from '@taskyard/test-utils';
import { createProject, listProjects, reorderProjects, updateProject } from './projects.js';
import { createTask } from './tasks.js';

describe('project order', () => {
  it('lists projects in sort order and keeps projects outside the reorder in place', () => {
    const ctx = createTestDb();
    try {
      const first = createProject(ctx.db, { name: 'Alpha' });
      const archived = createProject(ctx.db, { name: 'Middle' });
      const last = createProject(ctx.db, { name: 'Omega' });
      updateProject(ctx.db, archived.id, { archived: true });

      createTask(ctx.db, { project_id: first.id, title: 'Ready one', status: 'ready' });
      createTask(ctx.db, { project_id: first.id, title: 'Review one', status: 'review' });
      createTask(ctx.db, { project_id: last.id, title: 'Doing', status: 'in_progress' });

      const before = listProjects(ctx.db, { includeArchived: true }).map((project) => project.name);
      expect(before).toEqual(['Alpha', 'Middle', 'Omega']);

      reorderProjects(ctx.db, [last.id, first.id]);
      const after = listProjects(ctx.db, { includeArchived: true });
      expect(after.map((project) => project.name)).toEqual(['Omega', 'Middle', 'Alpha']);
      expect(listProjects(ctx.db).map((project) => project.name)).toEqual(['Omega', 'Alpha']);

      const alpha = after.find((project) => project.id === first.id);
      expect(alpha?.task_counts).toEqual({
        backlog: 0,
        ready: 1,
        in_progress: 0,
        review: 1,
        waiting: 0,
      });
      expect(after.find((project) => project.id === last.id)?.task_counts?.in_progress).toBe(1);
    } finally {
      ctx.cleanup();
    }
  });
});
