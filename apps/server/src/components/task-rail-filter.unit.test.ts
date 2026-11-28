import type { Task } from '@taskyard/protocol';
import { describe, expect, it } from 'vitest';
import { defaultTaskRailFilter, sortTasksForRail, STATUS_OPTIONS } from './task-rail-filter';

function task(id: number, overrides: Partial<Task>): Task {
  return {
    id: String(id),
    short_id: `TA-${id}`,
    project_id: 'project',
    parent_id: null,
    parent_short_id: null,
    title: 'Task',
    description: '',
    status: 'ready',
    task_type: 'feature',
    priority: 'high',
    category: null,
    assignee: null,
    blocked: false,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

describe('sortTasksForRail', () => {
  it('uses blocked state and status to break ties in the default priority sort', () => {
    const tasks = [
      task(6, { status: 'waiting', blocked: true }),
      task(7, { status: 'review', priority: 'medium' }),
      task(5, { status: 'in_progress', updated_at: '2026-11-03T00:00:00Z' }),
      task(4, { status: 'backlog' }),
      task(3, { status: 'ready' }),
      task(2, { status: 'waiting' }),
      task(8, { status: 'review', updated_at: '2026-11-02T00:00:00Z' }),
      task(1, { status: 'review' }),
      task(9, { status: 'merge' }),
      task(10, { status: 'completed' }),
      task(11, { status: 'cancelled' }),
    ];

    expect(sortTasksForRail(tasks, defaultTaskRailFilter().sort).map(({ id }) => id))
      .toEqual(['2', '9', '8', '1', '5', '3', '4', '10', '11', '6', '7']);
  });
});

it('lists statuses in workflow order in the task filter', () => {
  expect(STATUS_OPTIONS.map(({ label }) => label)).toEqual([
    'Waiting',
    'Ready to merge',
    'Ready to review',
    'In progress',
    'Ready',
    'Backlog',
    'Completed',
    'Cancelled',
  ]);
});
