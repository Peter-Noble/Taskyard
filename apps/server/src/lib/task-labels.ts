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

/**
 * Distinct non-empty categories from tasks, ranked by use count then recency.
 * Empty-query suggestions should show this order (popular / recently used).
 */
export function categoriesFromTasks(
  tasks: Array<Pick<Task, 'category' | 'updated_at'>>,
): string[] {
  const map = new Map<string, { label: string; count: number; latest: number }>();
  for (const task of tasks) {
    const category = task.category?.trim();
    if (!category) continue;
    const key = category.toLowerCase();
    const ts = Date.parse(task.updated_at) || 0;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { label: category, count: 1, latest: ts });
      continue;
    }
    prev.count += 1;
    if (ts >= prev.latest) {
      prev.latest = ts;
      prev.label = category;
    }
  }
  return [...map.values()]
    .sort(
      (a, b) =>
        b.count - a.count || b.latest - a.latest || a.label.localeCompare(b.label),
    )
    .map((entry) => entry.label);
}

/**
 * Merge suggestion lists without dropping known values when a slower fetch arrives.
 * Incoming order wins (ranked popular/recent); prev-only items append.
 */
export function mergeCategorySuggestions(prev: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return prev;
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of incoming) {
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  for (const raw of prev) {
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
}
