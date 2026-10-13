'use client';

import { useState } from 'react';
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

function FilterFunnelIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
      <path fill="currentColor" d="M1.5 2h13l-5 6.2V13l-3 1.5V8.2L1.5 2z" />
    </svg>
  );
}

function FilterPopover({
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
            <input type="checkbox" defaultChecked={opt.id === 'feature' || opt.id === 'bug'} />
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
  const activeCount = 3;

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

  const label = option === 'B' ? (activeCount > 0 ? `Filter · ${activeCount}` : 'Filter') : null;

  return (
    <>
      {option === 'A' ? (
        <button
          type="button"
          className={`ta35-filter-icon-btn${open || activeCount > 0 ? ' is-active' : ''}`}
          aria-label="Filter tasks"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <FilterFunnelIcon />
          {activeCount > 0 ? <span className="ta35-filter-count">{activeCount}</span> : null}
        </button>
      ) : (
        <button
          type="button"
          className={`ta35-filter-text-btn${open || activeCount > 0 ? ' is-active' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </button>
      )}
      <FilterPopover open={open} activeCount={activeCount} onClear={() => setOpen(false)} />
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
    A: 'Icon → checkbox popover',
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
