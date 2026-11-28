'use client';

import { useState, type ReactNode } from 'react';
import type { Task } from '@taskyard/protocol';
import {
  STATUS_OPTIONS,
  TASK_RAIL_GROUP_OPTIONS,
  type TaskRailGroupBy,
} from '@/components/task-rail-filter';
import { TASK_PRIORITIES, TASK_TYPES } from '@/lib/task-labels';

const designs = { A: 'Sections', B: 'Folders', C: 'Picker' } as const;
export type CategoryDesign = keyof typeof designs;

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

export function CategoryPrototypeSwitcher({
  design,
  onChange,
}: {
  design: CategoryDesign;
  onChange: (design: CategoryDesign) => void;
}) {
  return (
    <div className="ta27-switcher" role="group" aria-label="Category layout preview">
      {(Object.keys(designs) as CategoryDesign[]).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === design}
          onClick={() => onChange(option)}
        >
          {designs[option]}
        </button>
      ))}
    </div>
  );
}

type TaskGroup = { key: string; label: string; roots: Task[]; count: number; order: number };

export function TaskCategoryPrototype({
  design,
  groupBy,
  tasks,
  roots,
  selectedTaskId,
  renderTask,
}: {
  design: CategoryDesign;
  groupBy: GroupField;
  tasks: Task[];
  roots: Task[];
  selectedTaskId: string | null;
  renderTask: (task: Task) => ReactNode;
}) {
  const [expandedGroups, setExpandedGroups] = useState(() => new Map<string, boolean>());
  const [pickedKey, setPickedKey] = useState<string | null>(null);
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
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const defaultGroup = selectedTask ? groupsByKey.get(taskGroupKey(selectedTask, groupBy)) : groups[0];
  const picked = (pickedKey === null ? undefined : groupsByKey.get(pickedKey)) ?? defaultGroup;

  if (design === 'C' && picked) {
    const fieldLabel = TASK_RAIL_GROUP_OPTIONS.find(({ id }) => id === groupBy)?.label;
    return (
      <section aria-label={`Tasks by ${groupBy}`}>
        <div className="ta27-picker">
          <label htmlFor="ta27-category-picker">{fieldLabel}</label>
          <select
            id="ta27-category-picker"
            className="form-select"
            value={picked.key}
            onChange={(event) => setPickedKey(event.target.value)}
          >
            {groups.map((group) => (
              <option key={group.key} value={group.key}>{group.label} ({group.count})</option>
            ))}
          </select>
        </div>
        <div className="task-project-items">{picked.roots.map(renderTask)}</div>
      </section>
    );
  }

  const sections = design === 'A';
  const categoryGroups = groups.map((group) => {
    const open = expandedGroups.get(group.key) ?? (sections || group.key === defaultGroup?.key);
    const toggle = (
      <button
        className="ta27-category-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setExpandedGroups((current) => new Map(current).set(group.key, !open))}
      >
        <span className="ta27-category-chevron" aria-hidden="true" />
        <span className="ta27-category-name">{group.label}</span>
        <span className="ta27-category-count">{group.count}</span>
      </button>
    );
    return (
      <section
        key={group.key}
        className={sections ? 'ta27-section' : 'ta27-folder'}
        aria-label={group.label}
      >
        {sections ? <h2 className="ta27-section-head">{toggle}</h2> : toggle}
        {open ? <div className="task-project-items">{group.roots.map(renderTask)}</div> : null}
      </section>
    );
  });
  return sections ? categoryGroups : <div className="ta27-folders">{categoryGroups}</div>;
}
