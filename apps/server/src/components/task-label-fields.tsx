'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TaskPriority, TaskType } from '@taskyard/protocol';
import {
  TASK_PRIORITIES,
  TASK_TYPES,
  taskPriorityLabel,
  taskPriorityTone,
  taskTypeMeta,
} from '@/lib/task-labels';

export type TaskLabelValues = {
  taskType: TaskType;
  priority: TaskPriority;
  category: string;
};

type PillEditor = 'type' | 'priority' | 'category' | null;

function TypeSwatch({ typeId }: { typeId: TaskType }) {
  return <span className={`ta35-type-swatch ${taskTypeMeta(typeId).swatch}`} aria-hidden="true" />;
}

function PrioritySwatch({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`ta35-priority-swatch ${taskPriorityTone(priority)}`} aria-hidden="true" />
  );
}

function CategoryInput({
  id,
  value,
  onChange,
  suggestions,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
}) {
  const listId = `${id}-suggestions`;
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((item) => item.toLowerCase().includes(q));
  }, [suggestions, value]);

  return (
    <>
      <input
        id={id}
        className="form-input form-input-compact ta35-labels-control"
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

/** Create-form row — D-008 layout C. */
export function TaskLabelCreateFields({
  value,
  onChange,
  categorySuggestions = [],
}: {
  value: TaskLabelValues;
  onChange: (next: TaskLabelValues) => void;
  categorySuggestions?: string[];
}) {
  const categoryId = useId();
  return (
    <div className="ta35-labels-row ta35-labels-a">
      <label className="ta35-labels-field">
        <span className="form-label">Type</span>
        <span className="ta35-labels-select-wrap">
          <TypeSwatch typeId={value.taskType} />
          <select
            className="form-select form-select-compact ta35-labels-control"
            aria-label="Type"
            value={value.taskType}
            onChange={(event) => onChange({ ...value, taskType: event.target.value as TaskType })}
          >
            {TASK_TYPES.map((t) => (
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
          value={value.priority}
          onChange={(event) => onChange({ ...value, priority: event.target.value as TaskPriority })}
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="ta35-labels-field ta35-labels-field-grow">
        <span className="form-label">Category</span>
        <CategoryInput
          id={categoryId}
          value={value.category}
          onChange={(category) => onChange({ ...value, category })}
          suggestions={categorySuggestions}
        />
      </label>
    </div>
  );
}

/** Task-page header pills with edit popups — D-008. */
export function TaskLabelPills({
  value,
  onChange,
  categorySuggestions = [],
  disabled = false,
}: {
  value: TaskLabelValues;
  onChange: (next: TaskLabelValues) => void | Promise<void>;
  categorySuggestions?: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<PillEditor>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const categoryId = useId();
  const type = taskTypeMeta(value.taskType);

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
    if (disabled) return;
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
          disabled={disabled}
          onClick={() => toggle('type')}
        >
          <TypeSwatch typeId={value.taskType} />
          {type.label}
        </button>
        {open === 'type' ? (
          <div className="ta35-label-popup" role="dialog" aria-label="Change type">
            <div className="ta35-label-popup-options">
              {TASK_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ta35-label-popup-option${value.taskType === t.id ? ' is-selected' : ''}`}
                  onClick={() => {
                    void onChange({ ...value, taskType: t.id });
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
          className={`ta35-label-pill ta35-label-pill-priority ${taskPriorityTone(value.priority)}${open === 'priority' ? ' is-open' : ''}`}
          aria-expanded={open === 'priority'}
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => toggle('priority')}
        >
          <PrioritySwatch priority={value.priority} />
          {taskPriorityLabel(value.priority)}
        </button>
        {open === 'priority' ? (
          <div className="ta35-label-popup" role="dialog" aria-label="Change priority">
            <div className="ta35-label-popup-options">
              {TASK_PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`ta35-label-popup-option${value.priority === p.id ? ' is-selected' : ''}`}
                  onClick={() => {
                    void onChange({ ...value, priority: p.id });
                    setOpen(null);
                  }}
                >
                  <span className={`ta35-priority-swatch ${p.tone}`} aria-hidden="true" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </span>

      <span className="ta35-label-pill-wrap">
        <button
          type="button"
          className={`ta35-label-pill${value.category.trim() ? '' : ' ta35-label-pill-muted'}${open === 'category' ? ' is-open' : ''}`}
          aria-expanded={open === 'category'}
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => toggle('category')}
        >
          {value.category.trim() || 'No category'}
        </button>
        {open === 'category' ? (
          <div className="ta35-label-popup ta35-label-popup-category" role="dialog" aria-label="Change category">
            <label className="ta35-labels-field">
              <span className="form-label">Category</span>
              <CategoryInput
                id={categoryId}
                value={value.category}
                onChange={(category) => void onChange({ ...value, category })}
                suggestions={categorySuggestions}
              />
            </label>
            <div className="ta35-label-popup-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void onChange({ ...value, category: '' })}
              >
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
