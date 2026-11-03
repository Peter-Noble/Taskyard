'use client';

import { useMemo, useState } from 'react';
import type { Idea, IdeaStatus } from '@taskyard/protocol';
import { RailFilterPopover } from './rail-filter';

const STATUS_OPTIONS: Array<{ id: IdeaStatus; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
  { id: 'promoted', label: 'Promoted' },
];

export type IdeaRailSort = 'updated_desc' | 'created_desc' | 'created_asc' | 'title_asc' | 'id_asc';

export type IdeaRailFilterState = {
  statuses: Record<IdeaStatus, boolean>;
  sort: IdeaRailSort;
};

const SORT_OPTIONS: Array<{ id: IdeaRailSort; label: string }> = [
  { id: 'updated_desc', label: 'Recently updated' },
  { id: 'created_desc', label: 'Newest first' },
  { id: 'created_asc', label: 'Oldest first' },
  { id: 'title_asc', label: 'Title A–Z' },
  { id: 'id_asc', label: 'Idea ID' },
];

export function defaultIdeaRailFilter(): IdeaRailFilterState {
  return {
    statuses: { active: true, archived: false, promoted: false },
    sort: 'updated_desc',
  };
}

export function onlyIdeaStatus(status: IdeaStatus): IdeaRailFilterState {
  return {
    ...defaultIdeaRailFilter(),
    statuses: { active: false, archived: false, promoted: false, [status]: true },
  };
}

function timeMs(value: string): number {
  return Date.parse(value) || 0;
}

function compareIdeaId(a: Idea, b: Idea): number {
  return a.short_id.localeCompare(b.short_id, undefined, { numeric: true, sensitivity: 'base' });
}

export function filterAndSortIdeas(ideas: Idea[], filter: IdeaRailFilterState): Idea[] {
  const visible = ideas.filter((idea) => filter.statuses[idea.status]);
  visible.sort((a, b) => {
    switch (filter.sort) {
      case 'updated_desc':
        return timeMs(b.updated_at) - timeMs(a.updated_at) || compareIdeaId(a, b);
      case 'created_desc':
        return timeMs(b.created_at) - timeMs(a.created_at) || compareIdeaId(a, b);
      case 'created_asc':
        return timeMs(a.created_at) - timeMs(b.created_at) || compareIdeaId(a, b);
      case 'title_asc':
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || compareIdeaId(a, b);
      case 'id_asc':
        return compareIdeaId(a, b);
    }
  });
  return visible;
}

export function IdeaRailFilterButton({
  value,
  onChange,
}: {
  value: IdeaRailFilterState;
  onChange: (next: IdeaRailFilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const activeCount = useMemo(() => {
    const defaults = defaultIdeaRailFilter();
    const statusCount = STATUS_OPTIONS.filter(
      ({ id }) => value.statuses[id] !== defaults.statuses[id],
    ).length;
    return statusCount + (value.sort === defaults.sort ? 0 : 1);
  }, [value]);

  function toggle() {
    setDraft(value);
    setOpen((current) => !current);
  }

  function clear() {
    const next = defaultIdeaRailFilter();
    setDraft(next);
    onChange(next);
  }

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <RailFilterPopover
      label="Filter ideas"
      open={open}
      activeCount={activeCount}
      onToggle={toggle}
    >
      <h3>Sort</h3>
      <select
        className="form-select ta35-filter-sort"
        aria-label="Sort order"
        value={draft.sort}
        onChange={(event) =>
          setDraft((current) => ({ ...current, sort: event.target.value as IdeaRailSort }))
        }
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      <h3>Status</h3>
      <div className="ta35-filter-options">
        {STATUS_OPTIONS.map((option) => (
          <label key={option.id} className="ta35-filter-option">
            <input
              type="checkbox"
              checked={draft.statuses[option.id]}
              onChange={() =>
                setDraft((current) => ({
                  ...current,
                  statuses: {
                    ...current.statuses,
                    [option.id]: !current.statuses[option.id],
                  },
                }))
              }
            />
            {option.label}
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
    </RailFilterPopover>
  );
}
