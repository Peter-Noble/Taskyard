'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { useTestData } from '@/lib/hooks/use-test-data';
import {
  TEST_OVERVIEW_FINISHED,
  TEST_OVERVIEW_NEEDS_YOU,
  type OverviewItem,
} from '@/lib/test-data/fixtures';

function btnClass(variant?: 'primary' | 'ghost' | 'danger'): string {
  if (variant === 'primary') return 'btn btn-primary';
  if (variant === 'danger') return 'btn btn-danger';
  return 'btn btn-ghost';
}

function OverviewSection({
  id,
  label,
  items,
  muted,
  sectionClass,
  emptyMessage,
}: {
  id: string;
  label: string;
  items: OverviewItem[];
  muted?: boolean;
  sectionClass?: string;
  emptyMessage?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className={`overview-section${sectionClass ? ` ${sectionClass}` : ''}`} aria-labelledby={id}>
      <h2 id={id} className="overview-section-label">
        {label}
      </h2>
      {items.length === 0 ? (
        <p className="empty-state">{emptyMessage ?? 'Nothing here yet.'}</p>
      ) : (
        <ul className={`overview-list${muted ? ' overview-list-muted' : ''}`}>
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <li key={item.id} className={`overview-item${expanded ? ' is-expanded' : ''}`}>
                <button
                  type="button"
                  className="overview-item-trigger"
                  aria-expanded={expanded}
                  aria-controls={`overview-detail-${item.id}`}
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  <span className="overview-item-body">
                    <span className="overview-item-kind">{item.kind}</span>
                    <span className="overview-item-title">{item.title}</span>
                    <span className="overview-item-meta">{item.meta}</span>
                  </span>
                  <span className="overview-item-end">
                    <span className={`badge ${item.badgeClass} overview-item-badge`}>
                      <span className="badge-dot" />
                      {item.badgeLabel}
                    </span>
                    <span className="overview-chevron" aria-hidden="true" />
                  </span>
                </button>
                <div id={`overview-detail-${item.id}`} className="overview-item-detail" hidden={!expanded}>
                  <dl className="overview-detail-facts">
                    {item.facts.map((f) => (
                      <div key={f.dt}>
                        <dt>{f.dt}</dt>
                        <dd>{f.dd}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="overview-detail-note">{item.note}</p>
                  <div
                    className="overview-item-actions"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {item.actions.map((action) =>
                      action.href ? (
                        <Link key={action.label} href={action.href} className={btnClass(action.variant)}>
                          {action.label}
                        </Link>
                      ) : (
                        <button key={action.label} type="button" className={btnClass(action.variant)}>
                          {action.label}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function OverviewClient() {
  const { useTestData: testDataOn } = useTestData();

  const needsYou = useMemo(
    () => (testDataOn ? TEST_OVERVIEW_NEEDS_YOU : []),
    [testDataOn],
  );
  const finished = useMemo(
    () => (testDataOn ? TEST_OVERVIEW_FINISHED : []),
    [testDataOn],
  );

  return (
    <AppShell>
      <div className="main-padded">
        <div className="overview-page">
          <div className="overview-grid">
            <OverviewSection
              id="needs-you-heading"
              label="Needs your input"
              items={needsYou}
              sectionClass="overview-section-actions"
              emptyMessage={
                testDataOn
                  ? undefined
                  : 'Nothing waiting on you. Paused threads and open tasks will appear here.'
              }
            />
            <OverviewSection
              id="finished-heading"
              label="Finished"
              items={finished}
              muted
              sectionClass="overview-section-finished"
              emptyMessage={
                testDataOn ? undefined : 'Recently completed threads and tasks will appear here.'
              }
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
