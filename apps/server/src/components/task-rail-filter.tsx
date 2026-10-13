'use client';

import { useMemo, useState } from 'react';
import type { Task, TaskStatus, TaskType } from '@taskyard/protocol';
import { PRIORITY_RANK, TASK_PRIORITIES, TASK_TYPES } from '@/lib/task-labels';

// D-007
const STATUS_OPTIONS: Array<{ id: TaskStatus; label: string }> = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'ready', label: 'Ready' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'review', label: 'Ready to review' },
  { id: 'merge', label: 'Ready to merge' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const STATUS_RANK: Record<TaskStatus, number> = Object.fromEntries(
  STATUS_OPTIONS.map((opt, index) => [opt.id, index]),
) as Record<TaskStatus, number>;

const PRIORITY_MAX = TASK_PRIORITIES.length - 1;

export type TaskRailSort =
  | 'updated_desc'
  | 'created_desc'
  | 'created_asc'
  | 'priority_desc'
  | 'priority_asc'
  | 'status'
  | 'title_asc'
  | 'id_asc';

const SORT_OPTIONS: Array<{ id: TaskRailSort; label: string }> = [
  { id: 'priority_desc', label: 'Priority (high → low)' },
  { id: 'priority_asc', label: 'Priority (low → high)' },
  { id: 'updated_desc', label: 'Recently updated' },
  { id: 'created_desc', label: 'Newest first' },
  { id: 'created_asc', label: 'Oldest first' },
  { id: 'status', label: 'Status' },
  { id: 'title_asc', label: 'Title A–Z' },
  { id: 'id_asc', label: 'Task ID' },
];

export type TaskRailFilterState = {
  types: Record<TaskType, boolean>;
  statuses: Record<TaskStatus, boolean>;
  priorityMin: number;
  priorityMax: number;
  sort: TaskRailSort;
};

export function defaultTaskRailFilter(): TaskRailFilterState {
  return {
    types: Object.fromEntries(TASK_TYPES.map((t) => [t.id, true])) as Record<TaskType, boolean>,
    statuses: Object.fromEntries(
      STATUS_OPTIONS.map((s) => [s.id, s.id !== 'completed' && s.id !== 'cancelled']),
    ) as Record<TaskStatus, boolean>,
    priorityMin: 0,
    priorityMax: PRIORITY_MAX,
    sort: 'priority_desc',
  };
}

export function taskPassesRailFilter(task: Task, filter: TaskRailFilterState): boolean {
  if (!filter.types[task.task_type]) return false;
  if (!filter.statuses[task.status]) return false;
  const rank = PRIORITY_RANK[task.priority] ?? 1;
  if (rank < filter.priorityMin || rank > filter.priorityMax) return false;
  return true;
}

function timeMs(value: string): number {
  return Date.parse(value) || 0;
}

function compareTaskId(a: Task, b: Task): number {
  return a.short_id.localeCompare(b.short_id, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortTasksForRail(tasks: Task[], sort: TaskRailSort): Task[] {
  const ranked = [...tasks];
  ranked.sort((a, b) => {
    switch (sort) {
      case 'updated_desc':
        return timeMs(b.updated_at) - timeMs(a.updated_at) || compareTaskId(a, b);
      case 'created_desc':
        return timeMs(b.created_at) - timeMs(a.created_at) || compareTaskId(a, b);
      case 'created_asc':
        return timeMs(a.created_at) - timeMs(b.created_at) || compareTaskId(a, b);
      case 'priority_desc':
        return (
          (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
          timeMs(b.updated_at) - timeMs(a.updated_at) ||
          compareTaskId(a, b)
        );
      case 'priority_asc':
        return (
          (PRIORITY_RANK[a.priority] ?? 0) - (PRIORITY_RANK[b.priority] ?? 0) ||
          timeMs(b.updated_at) - timeMs(a.updated_at) ||
          compareTaskId(a, b)
        );
      case 'status':
        return (STATUS_RANK[a.status] ?? 0) - (STATUS_RANK[b.status] ?? 0) || compareTaskId(a, b);
      case 'title_asc':
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || compareTaskId(a, b);
      case 'id_asc':
        return compareTaskId(a, b);
    }
  });
  return ranked;
}

function snapPriority(value: number): number {
  return Math.max(0, Math.min(PRIORITY_MAX, Math.round(value)));
}

function FilterFunnelIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
      <path fill="currentColor" d="M1.5 2h13l-5 6.2V13l-3 1.5V8.2L1.5 2z" />
    </svg>
  );
}

function PriorityRangeSlider({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const minPct = (min / PRIORITY_MAX) * 100;
  const maxPct = (max / PRIORITY_MAX) * 100;
  return (
    <div className="ta35-priority-range">
      <div className="ta35-priority-range-track" aria-hidden="true">
        <div
          className="ta35-priority-range-fill"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
      </div>
      <input
        type="range"
        className="ta35-priority-range-input ta35-priority-range-input-min"
        min={0}
        max={PRIORITY_MAX}
        step={1}
        value={min}
        aria-label="Minimum priority"
        onChange={(event) => {
          const next = snapPriority(Number(event.target.value));
          onChange(Math.min(next, max), max);
        }}
      />
      <input
        type="range"
        className="ta35-priority-range-input ta35-priority-range-input-max"
        min={0}
        max={PRIORITY_MAX}
        step={1}
        value={max}
        aria-label="Maximum priority"
        onChange={(event) => {
          const next = snapPriority(Number(event.target.value));
          onChange(min, Math.max(next, min));
        }}
      />
      <div className="ta35-priority-range-labels" aria-hidden="true">
        {TASK_PRIORITIES.map((opt) => (
          <span key={opt.id}>{opt.short}</span>
        ))}
      </div>
      <p className="ta35-priority-range-value">
        {TASK_PRIORITIES[min]?.label}
        {min === max ? '' : ` – ${TASK_PRIORITIES[max]?.label}`}
      </p>
    </div>
  );
}

/** Funnel filter between project select and New task — D-007. */
export function TaskRailFilterButton({
  value,
  onChange,
}: {
  value: TaskRailFilterState;
  onChange: (next: TaskRailFilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const activeCount = useMemo(() => {
    const defaults = defaultTaskRailFilter();
    let count = 0;
    for (const t of TASK_TYPES) {
      if (value.types[t.id] !== defaults.types[t.id]) count += 1;
    }
    for (const s of STATUS_OPTIONS) {
      if (value.statuses[s.id] !== defaults.statuses[s.id]) count += 1;
    }
    if (value.priorityMin !== defaults.priorityMin || value.priorityMax !== defaults.priorityMax) {
      count += 1;
    }
    return count;
  }, [value]);

  function openPopover() {
    setDraft(value);
    setOpen((v) => !v);
  }

  function clear() {
    const next = defaultTaskRailFilter();
    setDraft(next);
    onChange(next);
  }

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`ta35-filter-icon-btn${open || activeCount > 0 ? ' is-active' : ''}`}
        aria-label="Filter tasks"
        aria-expanded={open}
        onClick={openPopover}
      >
        <FilterFunnelIcon />
        {activeCount > 0 ? <span className="ta35-filter-count">{activeCount}</span> : null}
      </button>
      {open ? (
        <div className="ta35-filter-popover" role="dialog" aria-label="Filter tasks">
          <h3>Sort</h3>
          <select
            className="form-select ta35-filter-sort"
            aria-label="Sort order"
            value={draft.sort}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, sort: event.target.value as TaskRailSort }))
            }
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <h3>Type</h3>
          <div className="ta35-filter-options">
            {TASK_TYPES.map((opt) => (
              <label key={opt.id} className="ta35-filter-option">
                <input
                  type="checkbox"
                  checked={draft.types[opt.id]}
                  onChange={() =>
                    setDraft((prev) => ({
                      ...prev,
                      types: { ...prev.types, [opt.id]: !prev.types[opt.id] },
                    }))
                  }
                />
                <span className={`ta35-type-swatch ${opt.swatch}`} />
                {opt.label}
              </label>
            ))}
          </div>

          <h3>Priority</h3>
          <PriorityRangeSlider
            min={draft.priorityMin}
            max={draft.priorityMax}
            onChange={(priorityMin, priorityMax) => setDraft((prev) => ({ ...prev, priorityMin, priorityMax }))}
          />

          <h3>Status</h3>
          <div className="ta35-filter-options">
            {STATUS_OPTIONS.map((opt) => (
              <label key={opt.id} className="ta35-filter-option">
                <input
                  type="checkbox"
                  checked={draft.statuses[opt.id]}
                  onChange={() =>
                    setDraft((prev) => ({
                      ...prev,
                      statuses: { ...prev.statuses, [opt.id]: !prev.statuses[opt.id] },
                    }))
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>

          <div className="ta35-filter-popover-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
              Clear
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
              Apply{activeCount > 0 ? ` · ${activeCount}` : ''}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
