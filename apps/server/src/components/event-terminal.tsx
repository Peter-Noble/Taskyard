'use client';

import { useEffect, useRef } from 'react';
import type { ThreadEvent } from '@taskyard/protocol';
import {
  type EventFilter,
  eventToTermLine,
  matchesEventFilter,
} from '@/lib/format-ui';

type EventTerminalProps = {
  events: ThreadEvent[];
  filter: EventFilter;
  emptyMessage?: string;
  minHeight?: number;
};

export function EventTerminal({
  events,
  filter,
  emptyMessage = 'No events yet.',
  minHeight = 320,
}: EventTerminalProps) {
  const endRef = useRef<HTMLDivElement>(null);

  const filtered = events.filter((e) => matchesEventFilter(e.event_type, filter));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filtered.length]);

  return (
    <div
      className="terminal"
      role="log"
      aria-live="polite"
      aria-label="Agent output stream"
      style={{ minHeight }}
    >
      {filtered.length === 0 ? (
        <span className="term-line term-dim">{emptyMessage}</span>
      ) : (
        filtered.map((ev) => {
          const line = eventToTermLine(ev.payload, ev.timestamp);
          return (
            <span key={ev.id} className={`term-line ${line.className}`}>
              {line.text}
            </span>
          );
        })
      )}
      <div ref={endRef} />
    </div>
  );
}

type FilterTabsProps = {
  filter: EventFilter;
  onChange: (filter: EventFilter) => void;
};

const TABS: { id: EventFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'thoughts', label: 'Thoughts' },
  { id: 'files', label: 'Files' },
  { id: 'commands', label: 'Commands' },
];

export function FilterTabs({ filter, onChange }: FilterTabsProps) {
  return (
    <div className="filter-tabs" role="tablist" aria-label="Log filters">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={filter === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
