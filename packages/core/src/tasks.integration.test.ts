import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { taskActivity } from '@taskyard/db';
import { createTestDb } from '@taskyard/test-utils';
import { createProject } from './projects.js';
import {
  addTaskDecision,
  addTaskDependency,
  claimTask,
  composeThreadPrompt,
  createTask,
  getTaskDetail,
  listPendingDecisions,
  listProjectDecisions,
  markDecisionsExported,
  nextTask,
  removeTaskDecision,
  TaskError,
  taskPrefixFromName,
  updateTask,
} from './tasks.js';

describe('task board', () => {
  it('builds a short prefix and includes the CLI contract in thread prompts', () => {
    expect(taskPrefixFromName('Taskyard')).toBe('TA');
    expect(taskPrefixFromName('Invoice parser')).toBe('IP');
    const prompt = composeThreadPrompt('Do the work', {
      short_id: 'TA-1',
      title: 'Ship it',
      description: 'Now',
    });
    expect(prompt).toContain('Do the work');
    expect(prompt).toContain('taskyard task claim');
    expect(prompt).toContain('.taskyard/project.json');
    expect(prompt).toContain('.taskyard/decisions.md');
    expect(prompt).toContain('TASKYARD_SESSION=autonomous');
    expect(prompt).toContain('taskyard task decision add --task <id> --choice');
    expect(prompt).toContain('still true in the code that remains');
    expect(prompt).toContain('prompt details this task removes');
    expect(prompt).toContain('`review` when `TASKYARD_SESSION=autonomous`');
  });

  it('assigns short ids, claims, dependencies, and exports decisions after completion', () => {
    const ctx = createTestDb();
    try {
      const project = createProject(ctx.db, { name: 'Taskyard' });
      const first = createTask(ctx.db, { project_id: project.id, title: 'Schema' });
      const second = createTask(ctx.db, {
        project_id: project.id,
        title: 'API',
        description: 'Routes',
      });

      expect(first.short_id).toBe('TA-1');
      expect(first.status).toBe('ready');
      expect(second.short_id).toBe('TA-2');

      addTaskDependency(ctx.db, second.short_id, first.short_id);
      expect(nextTask(ctx.db, project.id)?.short_id).toBe('TA-1');
      expect(() => claimTask(ctx.db, 'TA-2', 'agent-a')).toThrow(/blocked by TA-1/);

      const claimed = claimTask(ctx.db, 'TA-1', 'agent-a');
      expect(claimed?.status).toBe('in_progress');
      expect(claimed?.assignee).toBe('agent-a');
      expect(() => claimTask(ctx.db, 'TA-1', 'agent-b')).toThrow(TaskError);
      try {
        claimTask(ctx.db, 'TA-1', 'agent-b');
      } catch (err) {
        expect(err).toBeInstanceOf(TaskError);
        expect((err as TaskError).statusCode).toBe(409);
      }

      expect(() => updateTask(ctx.db, 'TA-1', { status: 'waiting' })).toThrow(/wait_reason/);
      updateTask(ctx.db, 'TA-1', { status: 'completed' });
      expect(nextTask(ctx.db, project.id)?.short_id).toBe('TA-2');

      const decision = addTaskDecision(ctx.db, 'TA-2', {
        choice: 'One worktree per thread',
        why: 'Agents must not share a dirty checkout',
      });
      expect(decision?.id).toBe('D-001');
      expect(listPendingDecisions(ctx.db, project.id)).toEqual([]);

      updateTask(ctx.db, 'TA-2', { status: 'completed' });
      expect(listPendingDecisions(ctx.db, project.id).map((item) => item.id)).toEqual(['D-001']);
      markDecisionsExported(ctx.db, project.id, ['D-001']);
      expect(listPendingDecisions(ctx.db, project.id)).toEqual([]);
      expect(listProjectDecisions(ctx.db, project.id).map((item) => item.id)).toEqual(['D-001']);

      const other = createProject(ctx.db, { name: 'Taskyard notes' });
      const third = createTask(ctx.db, { project_id: other.id, title: 'Elsewhere' });
      expect(third.short_id).toBe('TN-1');

      expect(() => addTaskDependency(ctx.db, 'TA-1', 'TA-1')).toThrow(/itself/);
    } finally {
      ctx.cleanup();
    }
  });

  it('records brief updates and statement decisions on the task', () => {
    const ctx = createTestDb();
    try {
      const project = createProject(ctx.db, { name: 'Taskyard' });
      const task = createTask(ctx.db, { project_id: project.id, title: 'Clean up the task view', description: 'Old brief' });
      updateTask(ctx.db, task.id, { description: 'New brief' });
      const decision = addTaskDecision(ctx.db, task.id, { choice: 'Keep the header on one line' });
      expect(decision?.why).toBe('');
      const removed = removeTaskDecision(ctx.db, task.id, decision!.id);
      const detail = getTaskDetail(ctx.db, task.id);
      expect(removed?.decisions).toEqual([]);
      expect(detail?.activity.map((item) => (item.type === 'change' ? item.summary : item.type))).toEqual([
        'set the brief',
        'updated the brief',
        'added a decision',
        'removed a decision',
      ]);
      expect(detail?.activity.filter((item) => item.type === 'change').map((item) => item.detail)).toEqual([
        'Old brief',
        'New brief',
        'Keep the header on one line',
        'Keep the header on one line',
      ]);
    } finally {
      ctx.cleanup();
    }
  });

  it('restores a brief history entry for a task that predates it', () => {
    const ctx = createTestDb();
    try {
      const project = createProject(ctx.db, { name: 'Taskyard' });
      const task = createTask(ctx.db, {
        project_id: project.id,
        title: 'Already described',
        description: 'The brief that was never logged',
      });
      ctx.db.delete(taskActivity).where(eq(taskActivity.taskId, task.id)).run();
      const detail = getTaskDetail(ctx.db, task.id);
      expect(detail?.activity).toEqual([
        expect.objectContaining({
          type: 'change',
          summary: 'set the brief',
          detail: 'The brief that was never logged',
        }),
      ]);
    } finally {
      ctx.cleanup();
    }
  });

  it('holds a review task for a person and keeps dependents blocked', () => {
    const ctx = createTestDb();
    try {
      const project = createProject(ctx.db, { name: 'Taskyard' });
      const done = createTask(ctx.db, { project_id: project.id, title: 'Finished work' });
      const follower = createTask(ctx.db, { project_id: project.id, title: 'Follows the review' });
      updateTask(ctx.db, done.short_id, { status: 'review' });
      addTaskDependency(ctx.db, follower.short_id, done.short_id);
      expect(nextTask(ctx.db, project.id)).toBeNull();
      expect(getTaskDetail(ctx.db, follower.short_id)?.blocked).toBe(true);
      expect(() => claimTask(ctx.db, follower.short_id, 'agent-a')).toThrow(/blocked by/);
      expect(() => claimTask(ctx.db, done.short_id, 'agent-a')).toThrow(/must be ready/);
    } finally {
      ctx.cleanup();
    }
  });

  it('rejects a dependency cycle', () => {
    const ctx = createTestDb();
    try {
      const project = createProject(ctx.db, { name: 'Cycle' });
      const a = createTask(ctx.db, { project_id: project.id, title: 'A' });
      const b = createTask(ctx.db, { project_id: project.id, title: 'B' });
      addTaskDependency(ctx.db, a.id, b.id);
      expect(() => addTaskDependency(ctx.db, b.id, a.id)).toThrow(/cycle/);
    } finally {
      ctx.cleanup();
    }
  });
});
