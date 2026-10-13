import type { Task, TaskPriority, TaskType } from '@taskyard/protocol';

export const TASK_TYPES: Array<{ id: TaskType; label: string; swatch: string }> = [
  { id: 'feature', label: 'Feature', swatch: 'type-feature' },
  { id: 'bug', label: 'Bug', swatch: 'type-bug' },
  { id: 'documentation', label: 'Documentation', swatch: 'type-docs' },
  { id: 'thought', label: 'Thought', swatch: 'type-thought' },
];

export const TASK_PRIORITIES: Array<{ id: TaskPriority; label: string; short: string; tone: string }> = [
  { id: 'low', label: 'Low', short: 'Low', tone: 'priority-low' },
  { id: 'medium', label: 'Medium', short: 'Med', tone: 'priority-medium' },
  { id: 'high', label: 'High', short: 'High', tone: 'priority-high' },
  { id: 'critical', label: 'Critical', short: 'Crit', tone: 'priority-critical' },
];

export const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function taskTypeMeta(id: TaskType) {
  return TASK_TYPES.find((t) => t.id === id) ?? TASK_TYPES[0]!;
}

export function taskPriorityMeta(id: TaskPriority) {
  return TASK_PRIORITIES.find((p) => p.id === id) ?? TASK_PRIORITIES[1]!;
}

export function taskPriorityLabel(id: TaskPriority) {
  return taskPriorityMeta(id).label;
}

export function taskPriorityTone(id: TaskPriority) {
  return taskPriorityMeta(id).tone;
}

/** Distinct non-empty categories from tasks, sorted for datalist display. */
export function categoriesFromTasks(tasks: Array<Pick<Task, 'category'>>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const task of tasks) {
    const category = task.category?.trim();
    if (!category) continue;
    const key = category.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(category);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/** Merge suggestion lists without dropping known values when a slower fetch arrives. */
export function mergeCategorySuggestions(prev: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return prev;
  const seen = new Set(prev.map((item) => item.toLowerCase()));
  let changed = false;
  const next = [...prev];
  for (const raw of incoming) {
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
    changed = true;
  }
  if (!changed) return prev;
  next.sort((a, b) => a.localeCompare(b));
  return next;
}
