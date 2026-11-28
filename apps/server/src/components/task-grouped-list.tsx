'use client';

import { useState, type ReactNode } from 'react';
import type { Task } from '@taskyard/protocol';
import { STATUS_OPTIONS, type TaskRailGroupBy } from '@/components/task-rail-filter';
import { TASK_PRIORITIES, TASK_TYPES } from '@/lib/task-labels';

type GroupField = Exclude<TaskRailGroupBy, 'none'>;

const groupOptions = {
  type: TASK_TYPES,
  priority: [...TASK_PRIORITIES].reverse(),
  status: STATUS_OPTIONS,
};

export function taskGroupKey(task: Task, groupBy: GroupField): string {
  if (groupBy === 'category') return task.category?.trim().toLowerCase() ?? '';
  return groupBy === 'type' ? task.task_type : task[groupBy];
}

type TaskGroup = { key: string; label: string; roots: Task[]; count: number; order: number };

export function TaskGroupedList({
  groupBy,
  tasks,
  roots,
  renderTask,
}: {
  groupBy: GroupField;
  tasks: Task[];
  roots: Task[];
  renderTask: (task: Task) => ReactNode;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set<string>());
  const options = groupBy === 'category' ? undefined : groupOptions[groupBy];
  const groupsByKey = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const key = taskGroupKey(task, groupBy);
    const group = groupsByKey.get(key);
    if (group) {
      group.count += 1;
      continue;
    }
    const index = options?.findIndex((option) => option.id === key) ?? -1;
    groupsByKey.set(key, {
      key,
      label: options ? options[index]?.label ?? key : task.category?.trim() || 'Uncategorized',
      roots: [],
      count: 1,
      order: index < 0 ? Number(!key) : index,
    });
  }
  for (const task of roots) {
    groupsByKey.get(taskGroupKey(task, groupBy))?.roots.push(task);
  }
  const groups = [...groupsByKey.values()].sort((a, b) =>
    a.order - b.order || a.label.localeCompare(b.label),
  );
  function toggleGroup(key: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return groups.map((group) => {
    const open = !collapsedGroups.has(group.key);
    return (
      <section key={group.key} className="task-rail-group" aria-label={group.label}>
        <h2 className="task-rail-group-head">
          <button
            className="task-rail-group-toggle"
            type="button"
            aria-expanded={open}
            onClick={() => toggleGroup(group.key)}
          >
            <span className="task-rail-group-chevron" aria-hidden="true" />
            <span className="task-rail-group-name">{group.label}</span>
            <span className="task-rail-group-count">{group.count}</span>
          </button>
        </h2>
        {open ? <div className="task-project-items">{group.roots.map(renderTask)}</div> : null}
      </section>
    );
  });
}
