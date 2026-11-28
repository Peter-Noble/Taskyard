'use client';

import { useState, type ReactNode } from 'react';
import type { Task } from '@taskyard/protocol';

const designs = { A: 'Sections', B: 'Folders', C: 'Picker' } as const;
export type CategoryDesign = keyof typeof designs;

export function taskCategoryKey(task: Task): string {
  return task.category?.trim().toLowerCase() ?? '';
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

type CategoryGroup = { key: string; label: string; roots: Task[]; count: number };

export function TaskCategoryPrototype({
  design,
  tasks,
  roots,
  selectedTaskId,
  renderTask,
}: {
  design: CategoryDesign;
  tasks: Task[];
  roots: Task[];
  selectedTaskId: string | null;
  renderTask: (task: Task) => ReactNode;
}) {
  const [expandedGroups, setExpandedGroups] = useState(() => new Map<string, boolean>());
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const groupsByKey = new Map<string, CategoryGroup>();
  for (const task of tasks) {
    const key = taskCategoryKey(task);
    const group = groupsByKey.get(key);
    if (group) group.count += 1;
    else groupsByKey.set(key, { key, label: task.category?.trim() || 'Uncategorized', roots: [], count: 1 });
  }
  for (const task of roots) {
    groupsByKey.get(taskCategoryKey(task))?.roots.push(task);
  }
  const groups = [...groupsByKey.values()].sort((a, b) =>
    Number(!a.key) - Number(!b.key) || a.label.localeCompare(b.label),
  );
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const defaultGroup = selectedTask ? groupsByKey.get(taskCategoryKey(selectedTask)) : groups[0];
  const picked = (pickedKey === null ? undefined : groupsByKey.get(pickedKey)) ?? defaultGroup;

  if (design === 'C' && picked) {
    return (
      <section aria-label="Tasks by category">
        <div className="ta27-picker">
          <label htmlFor="ta27-category-picker">Category</label>
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
