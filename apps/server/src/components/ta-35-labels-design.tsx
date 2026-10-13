'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
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

type PillEditor = 'type' | 'priority' | 'category' | null;

function TypeSwatch({ id }: { id: (typeof TYPES)[number]['id'] }) {
  const swatch = TYPES.find((t) => t.id === id)?.swatch ?? 'type-feature';
  return <span className={`ta35-type-swatch ${swatch}`} aria-hidden="true" />;
}

function CategoryField({
  value,
  onChange,
  id,
  compact = false,
}: {
  value: string;
  onChange: (next: string) => void;
  id: string;
  compact?: boolean;
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
        className={compact ? 'form-input form-input-compact ta35-labels-control' : 'form-input'}
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
            className="form-select form-select-compact ta35-labels-control"
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
          className="form-select form-select-compact ta35-labels-control"
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
          compact
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
            className="form-select form-select-compact ta35-labels-control"
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
            compact
          />
        </label>
      </div>
    </div>
  );
}

/** C — clickable header pills; each opens a small edit popup */
function LabelsEditablePills({
  state,
  onChange,
}: {
  state: LabelState;
  onChange: (next: LabelState) => void;
}) {
  const [open, setOpen] = useState<PillEditor>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const categoryInputId = useId();
  const type = TYPES.find((t) => t.id === state.typeId)!;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(null);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle(next: PillEditor) {
    setOpen((prev) => (prev === next ? null : next));
  }

  return (
    <div className="ta35-labels-pills" aria-label="Task labels" ref={rootRef}>
      <span className="ta35-label-pill-wrap">
        <button
          type="button"
          className={`ta35-label-pill ta35-label-pill-type ${type.swatch}${open === 'type' ? ' is-open' : ''}`}
          aria-expanded={open === 'type'}
          aria-haspopup="dialog"
          onClick={() => toggle('type')}
        >
          <TypeSwatch id={state.typeId} />
          {type.label}
        </button>
        {open === 'type' ? (
          <div className="ta35-label-popup" role="dialog" aria-label="Change type">
            <div className="ta35-label-popup-options">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ta35-label-popup-option${state.typeId === t.id ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange({ ...state, typeId: t.id });
                    setOpen(null);
                  }}
                >
                  <span className={`ta35-type-swatch ${t.swatch}`} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </span>

      <span className="ta35-label-pill-wrap">
        <button
          type="button"
          className={`ta35-label-pill${open === 'priority' ? ' is-open' : ''}`}
          aria-expanded={open === 'priority'}
          aria-haspopup="dialog"
          onClick={() => toggle('priority')}
        >
          {state.priority}
        </button>
        {open === 'priority' ? (
          <div className="ta35-label-popup" role="dialog" aria-label="Change priority">
            <div className="ta35-label-popup-options">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`ta35-label-popup-option${state.priority === p ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange({ ...state, priority: p });
                    setOpen(null);
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </span>

      <span className="ta35-label-pill-wrap">
        <button
          type="button"
          className={`ta35-label-pill${state.category.trim() ? '' : ' ta35-label-pill-muted'}${open === 'category' ? ' is-open' : ''}`}
          aria-expanded={open === 'category'}
          aria-haspopup="dialog"
          onClick={() => toggle('category')}
        >
          {state.category.trim() || 'No category'}
        </button>
        {open === 'category' ? (
          <div className="ta35-label-popup ta35-label-popup-category" role="dialog" aria-label="Change category">
            <label className="ta35-labels-field">
              <span className="form-label">Category</span>
              <CategoryField
                id={categoryInputId}
                value={state.category}
                onChange={(category) => onChange({ ...state, category })}
                compact
              />
            </label>
            <div className="ta35-label-popup-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ ...state, category: '' })}>
                Clear
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(null)}>
                Done
              </button>
            </div>
          </div>
        ) : null}
      </span>
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
        {option === 'A' || option === 'C' ? (
          <LabelsLayoutA state={state} onChange={onChange} mode="create" />
        ) : null}
        {option === 'B' ? <LabelsLayoutB state={state} onChange={onChange} mode="create" /> : null}
        {option === 'C' ? (
          <p className="ta35-labels-c-note">
            Same compact row as A on create. After create, values show as clickable header pills.
          </p>
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
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <section className="ta35-labels-panel" aria-label="Task page prototype">
      <h3 className="ta35-labels-panel-title">Task page</h3>
      <div className="task-view ta35-labels-task-view">
        <header className={`task-view-head${detailsOpen ? ' is-open' : ''}`}>
          <div className="task-view-top">
            <span className="entity-num">TA-35</span>
            <h2 className="task-detail-title">Add task type and priority labels</h2>
            <span className="task-view-inline-meta">Auto</span>
            {option === 'C' ? <LabelsEditablePills state={state} onChange={onChange} /> : null}
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
                <p className="ta35-labels-c-note">
                  Click a Type, Priority, or Category pill in the header to change it. Details stays for
                  brief and other metadata.
                </p>
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
    C: 'Header pills; click to edit in a popup (compact row on create)',
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
