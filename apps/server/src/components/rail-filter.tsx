'use client';

import type { ReactNode } from 'react';

function FilterFunnelIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
      <path fill="currentColor" d="M1.5 2h13l-5 6.2V13l-3 1.5V8.2L1.5 2z" />
    </svg>
  );
}

export function RailFilterPopover({
  label,
  open,
  activeCount,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  activeCount: number;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        className={`ta35-filter-icon-btn${open || activeCount > 0 ? ' is-active' : ''}`}
        aria-label={label}
        aria-expanded={open}
        onClick={onToggle}
      >
        <FilterFunnelIcon />
        {activeCount > 0 ? <span className="ta35-filter-count">{activeCount}</span> : null}
      </button>
      {open ? (
        <div className="ta35-filter-popover" role="dialog" aria-label={label}>
          {children}
        </div>
      ) : null}
    </>
  );
}
