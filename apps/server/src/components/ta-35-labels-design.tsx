'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  TA35_LABELS_OPTIONS,
  TA35_LABELS_PARAM,
  type Ta35LabelsOption,
} from '@/lib/ta-35-labels';

export type { Ta35LabelsOption };

const TYPES = [
  { id: 'feature', label: 'Feature', swatch: 'type-feature' },
  { id: 'bug', label: 'Bug', swatch: 'type-bug' },
  { id: 'docs', label: 'Documentation', swatch: 'type-docs' },
  { id: 'thought', label: 'Thought', swatch: 'type-thought' },
] as const;

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

const CATEGORY_SUGGESTIONS = ['Performance', 'Auth', 'Dashboard', 'CLI', 'Install'];

type LabelState = {
  typeId: (typeof TYPES)[number]['id'];
  priority: (typeof PRIORITIES)[number];
  category: string;
};

function TypeSwatch({ id }: { id: (typeof TYPES)[number]['id'] }) {
  const swatch = TYPES.find((t) => t.id === id)?.swatch ?? 'type-feature';
  return <span className={`ta35-type-swatch ${swatch}`} aria-hidden="true" />;
}

function CategoryField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  id: string;
}) {
  const listId = `${id}-suggestions`;
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return CATEGORY_SUGGESTIONS;
    return CATEGORY_SUGGESTIONS.filter((item) => item.toLowerCase().includes(q));
  }, [value]);

  return (
    <>
      <input
        id={id}
        className="form-input"
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. Performance"
        autoComplete="off"
      />
      <datalist id={listId}>
        {filtered.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </>
  );
}

/** A — compact select row under the title */
function LabelsLayoutA({
  state,
  onChange,
  mode,
}: {
  state: LabelState;
  onChange: (next: LabelState) => void;
  mode: 'create' | 'detail';
}) {
  return (
    <div className="ta35-labels-row ta35-labels-a">
      <label className="ta35-labels-field">
        <span className="form-label">Type</span>
        <span className="ta35-labels-select-wrap">
          <TypeSwatch id={state.typeId} />
          <select
            className="form-select form-select-compact"
            aria-label="Type"
            value={state.typeId}
            onChange={(event) =>
              onChange({ ...state, typeId: event.target.value as LabelState['typeId'] })
            }
          >
            {TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label className="ta35-labels-field">
        <span className="form-label">Priority</span>
        <select
          className="form-select form-select-compact"
          aria-label="Priority"
          value={state.priority}
          onChange={(event) =>
            onChange({ ...state, priority: event.target.value as LabelState['priority'] })
          }
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="ta35-labels-field ta35-labels-field-grow">
        <span className="form-label">Category</span>
        <CategoryField
          id={`ta35-cat-${mode}-a`}
          value={state.category}
          onChange={(category) => onChange({ ...state, category })}
        />
      </label>
    </div>
  );
}

/** B — type as colour chips; priority select; category below */
function LabelsLayoutB({
  state,
  onChange,
  mode,
}: {
  state: LabelState;
  onChange: (next: LabelState) => void;
  mode: 'create' | 'detail';
}) {
  return (
    <div className="ta35-labels-b">
      <div className="ta35-labels-field">
        <span className="form-label">Type</span>
        <div className="ta35-type-chips" role="group" aria-label="Type">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ta35-type-chip${state.typeId === t.id ? ' is-selected' : ''}`}
              aria-pressed={state.typeId === t.id}
              onClick={() => onChange({ ...state, typeId: t.id })}
            >
              <span className={`ta35-type-swatch ${t.swatch}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ta35-labels-row">
        <label className="ta35-labels-field">
          <span className="form-label">Priority</span>
          <select
            className="form-select form-select-compact"
            aria-label="Priority"
            value={state.priority}
            onChange={(event) =>
              onChange({ ...state, priority: event.target.value as LabelState['priority'] })
            }
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="ta35-labels-field ta35-labels-field-grow">
          <span className="form-label">Category</span>
          <CategoryField
            id={`ta35-cat-${mode}-b`}
            value={state.category}
            onChange={(category) => onChange({ ...state, category })}
          />
        </label>
      </div>
    </div>
  );
}

/** C — read-only pills in the header; edit controls in a details block */
function LabelsDisplayPills({ state }: { state: LabelState }) {
  const type = TYPES.find((t) => t.id === state.typeId)!;
  return (
    <div className="ta35-labels-pills" aria-label="Task labels">
      <span className={`ta35-label-pill ta35-label-pill-type ${type.swatch}`}>
        <TypeSwatch id={state.typeId} />
        {type.label}
      </span>
      <span className="ta35-label-pill">{state.priority}</span>
      {state.category.trim() ? (
        <span className="ta35-label-pill ta35-label-pill-category">{state.category}</span>
      ) : (
        <span className="ta35-label-pill ta35-label-pill-muted">No category</span>
      )}
    </div>
  );
}

function LabelsLayoutCEdit({
  state,
  onChange,
  mode,
}: {
  state: LabelState;
  onChange: (next: LabelState) => void;
  mode: 'create' | 'detail';
}) {
  return (
    <div className="ta35-labels-c-edit">
      <p className="ta35-labels-c-note">
        {mode === 'detail'
          ? 'Shown as pills in the header; edit here (Details-style).'
          : 'On create, fields stay in the form; after create they become header pills.'}
      </p>
      <LabelsLayoutA state={state} onChange={onChange} mode={mode} />
    </div>
  );
}

function ListRowPreview({ state }: { state: LabelState }) {
  const type = TYPES.find((t) => t.id === state.typeId)!;
  return (
    <div className="ta35-labels-list-preview" aria-label="Task list preview">
      <span className="ta35-labels-list-preview-label">Left list row</span>
      <div className="ta35-labels-list-row">
        <span className={`ta35-type-swatch ${type.swatch}`} />
        <span className="ta35-labels-list-id">TA-35</span>
        <span className="ta35-labels-list-title">Add task type and priority labels</span>
        <span className="ta35-labels-list-meta">{state.priority}</span>
        {state.category.trim() ? (
          <span className="ta35-labels-list-cat">{state.category}</span>
        ) : null}
      </div>
    </div>
  );
}

function CreateMock({
  option,
  state,
  onChange,
}: {
  option: Ta35LabelsOption;
  state: LabelState;
  onChange: (next: LabelState) => void;
}) {
  return (
    <section className="ta35-labels-panel" aria-label="New task prototype">
      <h3 className="ta35-labels-panel-title">New task</h3>
      <div className="task-editor">
        <label className="form-field">
          <span className="form-label">Title</span>
          <input className="form-input" defaultValue="Snappy filter defaults" readOnly />
        </label>
        {option === 'A' ? <LabelsLayoutA state={state} onChange={onChange} mode="create" /> : null}
        {option === 'B' ? <LabelsLayoutB state={state} onChange={onChange} mode="create" /> : null}
        {option === 'C' ? (
          <LabelsLayoutCEdit state={state} onChange={onChange} mode="create" />
        ) : null}
        <label className="form-field">
          <span className="form-label">Description</span>
          <textarea className="form-textarea" rows={3} defaultValue="Prototype only — not saved." readOnly />
        </label>
        <div className="task-editor-actions">
          <button type="button" className="btn btn-primary" disabled>
            Create task
          </button>
          <button type="button" className="btn btn-ghost" disabled>
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

function DetailMock({
  option,
  state,
  onChange,
}: {
  option: Ta35LabelsOption;
  state: LabelState;
  onChange: (next: LabelState) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(option === 'C');

  return (
    <section className="ta35-labels-panel" aria-label="Task page prototype">
      <h3 className="ta35-labels-panel-title">Task page</h3>
      <div className="task-view ta35-labels-task-view">
        <header className={`task-view-head${detailsOpen ? ' is-open' : ''}`}>
          <div className="task-view-top">
            <span className="entity-num">TA-35</span>
            <h2 className="task-detail-title">Add task type and priority labels</h2>
            <span className="task-view-inline-meta">Auto</span>
            {option === 'C' ? <LabelsDisplayPills state={state} /> : null}
            <span className="task-view-top-actions">
              <button
                type="button"
                className="task-view-details-toggle"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((v) => !v)}
              >
                Details
              </button>
              <span className="badge badge-task-progress task-view-status-badge">In progress</span>
            </span>
          </div>
          {option !== 'C' ? (
            <div className="ta35-labels-detail-inline">
              {option === 'A' ? (
                <LabelsLayoutA state={state} onChange={onChange} mode="detail" />
              ) : (
                <LabelsLayoutB state={state} onChange={onChange} mode="detail" />
              )}
            </div>
          ) : null}
          {detailsOpen ? (
            <div className="task-view-details">
              {option === 'C' ? (
                <LabelsLayoutCEdit state={state} onChange={onChange} mode="detail" />
              ) : (
                <p className="ta35-labels-c-note">
                  Brief and other details stay here. Labels edit inline above in this option.
                </p>
              )}
              <div className="task-view-detail-block">
                <span className="form-label">Brief</span>
                <p className="task-view-brief">Prototype brief — labels UI only.</p>
              </div>
            </div>
          ) : null}
        </header>
      </div>
    </section>
  );
}

export function Ta35LabelsDesignPicker({ option }: { option: Ta35LabelsOption }) {
  const router = useRouter();
  const pathname = usePathname();

  function go(next: Ta35LabelsOption | null) {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    );
    if (next) params.set(TA35_LABELS_PARAM, next);
    else params.delete(TA35_LABELS_PARAM);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const blurbs: Record<Ta35LabelsOption, string> = {
    A: 'Compact Type / Priority / Category selects under the title',
    B: 'Coloured Type chips + Priority select + Category field',
    C: 'Header pills on the task page; edit in Details (form fields on create)',
  };

  return (
    <div className="ta35-design-picker" role="region" aria-label="TA-35 label field prototypes">
      <span className="ta35-design-picker-label">TA-35 labels</span>
      <div className="ta35-design-picker-options">
        {TA35_LABELS_OPTIONS.map((opt) => (
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

/** Prototype board for Type / Priority / Category set + display. Remove with TA-35. */
export function Ta35LabelsDesignBoard({ option }: { option: Ta35LabelsOption }) {
  const [createState, setCreateState] = useState<LabelState>({
    typeId: 'feature',
    priority: 'High',
    category: 'Performance',
  });
  const [detailState, setDetailState] = useState<LabelState>({
    typeId: 'bug',
    priority: 'Critical',
    category: 'Auth',
  });

  return (
    <div className="ta35-labels-board">
      <p className="ta35-labels-lede">
        Prototypes for setting and showing <strong>Type</strong>, <strong>Priority</strong>, and{' '}
        <strong>Category</strong> on create and the task page. Category ships with TA-27; Type and
        Priority with TA-35 — pick a layout that works for both.
      </p>
      <div className="ta35-labels-columns">
        <CreateMock option={option} state={createState} onChange={setCreateState} />
        <DetailMock option={option} state={detailState} onChange={setDetailState} />
      </div>
      <ListRowPreview state={detailState} />
    </div>
  );
}
