'use client';

import { useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  TA35_DESIGN_OPTIONS,
  TA35_DESIGN_PARAM,
  type Ta35DesignOption,
} from '@/lib/ta-35-design';

export type { Ta35DesignOption };
export { TA35_DESIGN_OPTIONS, TA35_DESIGN_PARAM };

const TYPE_OPTIONS = [
  { id: 'feature', label: 'Feature', swatch: 'type-feature' },
  { id: 'bug', label: 'Bug', swatch: 'type-bug' },
  { id: 'docs', label: 'Documentation', short: 'Docs', swatch: 'type-docs' },
  { id: 'thought', label: 'Thought', swatch: 'type-thought' },
] as const;

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium', short: 'Med' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical', short: 'Crit' },
] as const;

const STATUS_OPTIONS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'ready', label: 'Ready' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'review', label: 'Ready to review' },
  { id: 'merge', label: 'Ready to merge' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

const PRIORITY_MAX = PRIORITY_OPTIONS.length - 1;

function FilterFunnelIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
      <path fill="currentColor" d="M1.5 2h13l-5 6.2V13l-3 1.5V8.2L1.5 2z" />
    </svg>
  );
}

function snapPriority(value: number): number {
  return Math.max(0, Math.min(PRIORITY_MAX, Math.round(value)));
}

/** Dual-thumb priority band; snaps to Low / Medium / High / Critical. */
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
        {PRIORITY_OPTIONS.map((opt) => (
          <span key={opt.id}>{opt.short ?? opt.label}</span>
        ))}
      </div>
      <p className="ta35-priority-range-value">
        {PRIORITY_OPTIONS[min]?.label}
        {min === max ? '' : ` – ${PRIORITY_OPTIONS[max]?.label}`}
      </p>
    </div>
  );
}

function DesignAFilterPopover({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [types, setTypes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TYPE_OPTIONS.map((opt) => [opt.id, true])),
  );
  const [statuses, setStatuses] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STATUS_OPTIONS.map((opt) => [opt.id, true])),
  );
  const [priorityMin, setPriorityMin] = useState(0);
  const [priorityMax, setPriorityMax] = useState(PRIORITY_MAX);

  const activeCount = useMemo(() => {
    const typeOff = TYPE_OPTIONS.filter((opt) => !types[opt.id]).length;
    const statusOff = STATUS_OPTIONS.filter((opt) => !statuses[opt.id]).length;
    const priorityNarrow = priorityMin > 0 || priorityMax < PRIORITY_MAX ? 1 : 0;
    return typeOff + statusOff + priorityNarrow;
  }, [types, statuses, priorityMin, priorityMax]);

  if (!open) return null;

  function clear() {
    setTypes(Object.fromEntries(TYPE_OPTIONS.map((opt) => [opt.id, true])));
    setStatuses(Object.fromEntries(STATUS_OPTIONS.map((opt) => [opt.id, true])));
    setPriorityMin(0);
    setPriorityMax(PRIORITY_MAX);
  }

  return (
    <div className="ta35-filter-popover" role="dialog" aria-label="Filter tasks">
      <h3>Type</h3>
      <div className="ta35-filter-options">
        {TYPE_OPTIONS.map((opt) => (
          <label key={opt.id} className="ta35-filter-option">
            <input
              type="checkbox"
              checked={types[opt.id]}
              onChange={() => setTypes((prev) => ({ ...prev, [opt.id]: !prev[opt.id] }))}
            />
            <span className={`ta35-type-swatch ${opt.swatch}`} />
            {opt.label}
          </label>
        ))}
      </div>

      <h3>Priority</h3>
      <PriorityRangeSlider
        min={priorityMin}
        max={priorityMax}
        onChange={(nextMin, nextMax) => {
          setPriorityMin(nextMin);
          setPriorityMax(nextMax);
        }}
      />

      <h3>Status</h3>
      <div className="ta35-filter-options">
        {STATUS_OPTIONS.map((opt) => (
          <label key={opt.id} className="ta35-filter-option">
            <input
              type="checkbox"
              checked={statuses[opt.id]}
              onChange={() => setStatuses((prev) => ({ ...prev, [opt.id]: !prev[opt.id] }))}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <div className="ta35-filter-popover-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
          Clear
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
          Apply{activeCount > 0 ? ` · ${activeCount}` : ''}
        </button>
      </div>
    </div>
  );
}

function FilterPopoverB({
  open,
  activeCount,
  onClear,
}: {
  open: boolean;
  activeCount: number;
  onClear: () => void;
}) {
  if (!open) return null;
  return (
    <div className="ta35-filter-popover" role="dialog" aria-label="Filter tasks">
      <h3>Type</h3>
      <div className="ta35-filter-options">
        {TYPE_OPTIONS.map((opt) => (
          <label key={opt.id} className="ta35-filter-option">
            <input type="checkbox" defaultChecked />
            <span className={`ta35-type-swatch ${opt.swatch}`} />
            {opt.label}
          </label>
        ))}
      </div>
      <h3>Priority</h3>
      <div className="ta35-filter-options">
        {PRIORITY_OPTIONS.map((opt) => (
          <label key={opt.id} className="ta35-filter-option">
            <input type="checkbox" defaultChecked={opt.id === 'high'} />
            {opt.label}
          </label>
        ))}
      </div>
      <div className="ta35-filter-popover-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
          Clear
        </button>
        <button type="button" className="btn btn-primary btn-sm">
          Apply{activeCount > 0 ? ` · ${activeCount}` : ''}
        </button>
      </div>
    </div>
  );
}

/** Prototype-only controls between project select and New task. Remove with TA-35. */
export function Ta35FilterDesignControls({
  option,
  stripOpen = true,
  onStripOpenChange,
}: {
  option: Ta35DesignOption;
  stripOpen?: boolean;
  onStripOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = option === 'A' ? 0 : 3;

  if (option === 'D') {
    return (
      <div className="ta35-dual-menus">
        <select className="form-select" aria-label="Type filter" defaultValue="feature">
          <option value="">Any type</option>
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.short ?? opt.label}
            </option>
          ))}
        </select>
        <select className="form-select" aria-label="Priority filter" defaultValue="high">
          <option value="">Any pri</option>
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.short ?? opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (option === 'C') {
    return (
      <button
        type="button"
        className={`ta35-filter-icon-btn${stripOpen ? ' is-active' : ''}`}
        aria-label="Filter tasks"
        aria-expanded={stripOpen}
        aria-controls="ta35-filter-strip"
        onClick={() => onStripOpenChange?.(!stripOpen)}
      >
        <FilterFunnelIcon />
        {activeCount > 0 ? <span className="ta35-filter-count">{activeCount}</span> : null}
      </button>
    );
  }

  if (option === 'A') {
    return (
      <>
        <button
          type="button"
          className={`ta35-filter-icon-btn${open ? ' is-active' : ''}`}
          aria-label="Filter tasks"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <FilterFunnelIcon />
        </button>
        <DesignAFilterPopover open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  const label = activeCount > 0 ? `Filter · ${activeCount}` : 'Filter';

  return (
    <>
      <button
        type="button"
        className={`ta35-filter-text-btn${open || activeCount > 0 ? ' is-active' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      <FilterPopoverB open={open} activeCount={activeCount} onClear={() => setOpen(false)} />
    </>
  );
}

export function Ta35FilterDesignStrip({
  option,
  open = true,
}: {
  option: Ta35DesignOption;
  open?: boolean;
}) {
  const [types, setTypes] = useState<Record<string, boolean>>({
    feature: true,
    bug: true,
    docs: false,
    thought: false,
  });
  const [priorities, setPriorities] = useState<Record<string, boolean>>({
    low: false,
    medium: false,
    high: true,
    critical: false,
  });

  if (option !== 'C' || !open) return null;

  return (
    <div className="ta35-filter-strip" id="ta35-filter-strip">
      <div className="ta35-filter-strip-row">
        <span className="ta35-filter-strip-label">Type</span>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="ta35-chip"
            aria-pressed={types[opt.id]}
            onClick={() => setTypes((prev) => ({ ...prev, [opt.id]: !prev[opt.id] }))}
          >
            <span className={`ta35-type-swatch ${opt.swatch}`} />
            {opt.short ?? opt.label}
          </button>
        ))}
      </div>
      <div className="ta35-filter-strip-row">
        <span className="ta35-filter-strip-label">Priority</span>
        {PRIORITY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className="ta35-chip"
            aria-pressed={priorities[opt.id]}
            onClick={() => setPriorities((prev) => ({ ...prev, [opt.id]: !prev[opt.id] }))}
          >
            {opt.short ?? opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Ta35DesignPicker({ option }: { option: Ta35DesignOption }) {
  const router = useRouter();
  const pathname = usePathname();

  function go(next: Ta35DesignOption | null) {
    const params = new URLSearchParams();
    if (next) params.set(TA35_DESIGN_PARAM, next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const blurbs: Record<Ta35DesignOption, string> = {
    A: 'Icon → Type / priority range / status',
    B: 'Labeled Filter → same popover',
    C: 'Icon → inline chip strip',
    D: 'Two compact Type / Priority selects',
  };

  return (
    <div className="ta35-design-picker" role="region" aria-label="TA-35 filter design prototypes">
      <span className="ta35-design-picker-label">TA-35 filter prototypes</span>
      <div className="ta35-design-picker-options">
        {TA35_DESIGN_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`ta35-design-pick${option === opt ? ' is-current' : ''}`}
            aria-pressed={option === opt}
            onClick={() => go(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      <span className="ta35-design-picker-blurb">{blurbs[option]}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(null)}>
        Exit
      </button>
    </div>
  );
}
