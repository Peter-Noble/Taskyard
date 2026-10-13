import type { TaskPriority, TaskType } from '@taskyard/protocol';

export const TASK_TYPES: Array<{ id: TaskType; label: string; swatch: string }> = [
  { id: 'feature', label: 'Feature', swatch: 'type-feature' },
  { id: 'bug', label: 'Bug', swatch: 'type-bug' },
  { id: 'documentation', label: 'Documentation', swatch: 'type-docs' },
  { id: 'thought', label: 'Thought', swatch: 'type-thought' },
];

export const TASK_PRIORITIES: Array<{ id: TaskPriority; label: string; short: string }> = [
  { id: 'low', label: 'Low', short: 'Low' },
  { id: 'medium', label: 'Medium', short: 'Med' },
  { id: 'high', label: 'High', short: 'High' },
  { id: 'critical', label: 'Critical', short: 'Crit' },
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

export function taskPriorityLabel(id: TaskPriority) {
  return TASK_PRIORITIES.find((p) => p.id === id)?.label ?? id;
}
