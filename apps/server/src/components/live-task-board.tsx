'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { Project, Task, TaskDetail, TaskStatus } from '@taskyard/protocol';
import { useSessionPerson } from '@/components/providers';
import {
  TaskLabelCreateFields,
  TaskLabelPills,
  type TaskLabelValues,
} from '@/components/task-label-fields';
import {
  sortTasksForRail,
  taskPassesRailFilter,
  type TaskRailFilterState,
} from '@/components/task-rail-filter';
import { categoriesFromTasks, taskPriorityLabel, taskPriorityTone, taskTypeMeta } from '@/lib/task-labels';
import { ChatCommentComposer, ChatMessage } from '@/components/chat-message';
import { MarkdownMessage } from '@/components/markdown-message';
import { fetchTasksForProject, type ApiTask } from '@/lib/tasks-api';

function useProjectCategorySuggestions(projectId: string | null | undefined, refreshKey = 0) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    if (!projectId) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/tasks?project_id=${encodeURIComponent(projectId)}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { tasks?: Task[] };
        if (cancelled) return;
        setSuggestions(categoriesFromTasks(data.tasks ?? []));
      })
      .catch(() => {
        /* suggestions are optional */
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);
  return suggestions;
}

const STATUSES: TaskStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'review',
  'merge',
  'waiting',
  'completed',
  'cancelled',
];

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case 'backlog':
      return 'Backlog';
    case 'ready':
      return 'Ready';
    case 'in_progress':
      return 'In progress';
    case 'review':
      return 'Ready to review';
    case 'merge':
      return 'Ready to merge';
    case 'waiting':
      return 'Waiting';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

function badgeClass(status: TaskStatus): string {
  switch (status) {
    case 'ready':
      return 'badge-task-ready';
    case 'in_progress':
      return 'badge-task-progress';
    case 'review':
      return 'badge-task-review';
    case 'merge':
      return 'badge-task-merge';
    case 'waiting':
      return 'badge-task-waiting';
    case 'completed':
      return 'badge-task-done';
    default:
      return 'badge-task-backlog';
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

type TaskDependency = { taskId: string; dependsOnId: string };
type ProjectTaskSnapshot = { tasks: Task[]; dependencies: TaskDependency[] };

export function LiveTaskRail({
  projectId,
  selectedTaskId,
  onSelectTask,
  onSelectedUpdatedAt,
  filter,
}: {
  projectId: string | null;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onSelectedUpdatedAt?: (updatedAt: string | null) => void;
  filter?: TaskRailFilterState;
}) {
  const [{ tasks, dependencies }, setSnapshot] = useState<ProjectTaskSnapshot>({ tasks: [], dependencies: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setSnapshot({ tasks: [], dependencies: [] });
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ project_id: projectId, include_dependencies: '1' });
    const source = new EventSource(`/api/tasks/stream?${params}`);
    source.onmessage = (event) => {
      if (cancelled) return;
      try {
        const next = JSON.parse(event.data) as ProjectTaskSnapshot;
        if (Array.isArray(next.tasks) && Array.isArray(next.dependencies)) setSnapshot(next);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    };
    source.onerror = () => {
      if (!cancelled) setLoading(false);
    };
    return () => {
      cancelled = true;
      source.close();
    };
  }, [projectId]);

  useEffect(() => {
    if (!onSelectedUpdatedAt) return;
    const match = tasks.find((task) => task.id === selectedTaskId);
    onSelectedUpdatedAt(match?.updated_at ?? null);
  }, [tasks, selectedTaskId, onSelectedUpdatedAt]);

  const filtered = filter
    ? tasks.filter((task) => taskPassesRailFilter(task, filter))
    : tasks.filter((task) => task.status !== 'cancelled');
  const sort = filter?.sort ?? 'priority_desc';
  const visible = sortTasksForRail(filtered, sort);
  const visibleIds = new Set(visible.map((task) => task.id));
  const roots = visible.filter((task) => !task.parent_id || !visibleIds.has(task.parent_id));
  const open = roots.filter((task) => task.status !== 'completed');
  const completed = roots.filter((task) => task.status === 'completed');
  const parentIdsByTask = new Map<string, Set<string>>();
  for (const task of visible) {
    parentIdsByTask.set(task.id, new Set(task.parent_id ? [task.parent_id] : []));
  }
  for (const { taskId, dependsOnId } of dependencies) {
    parentIdsByTask.get(taskId)?.add(dependsOnId);
  }
  const childrenByTask = new Map<string, Task[]>();
  for (const task of visible) {
    for (const parentId of parentIdsByTask.get(task.id) ?? []) {
      const children = childrenByTask.get(parentId);
      if (children) children.push(task);
      else childrenByTask.set(parentId, [task]);
    }
  }

  function renderTask(task: Task, ancestors: string[] = []) {
    const type = taskTypeMeta(task.task_type);
    const nested = ancestors.length > 0;
    const path = [...ancestors, task.id];
    const children = (childrenByTask.get(task.id) ?? []).filter((child) => !path.includes(child.id));
    const branch = children.length > 0;
    let waiting = 0;
    let containsSelection = false;
    if (branch) {
      const seen = new Set(path);
      const pending = [...children];
      while (pending.length > 0) {
        const child = pending.pop()!;
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        if (child.status === 'waiting') waiting++;
        if (child.id === selectedTaskId) containsSelection = true;
        pending.push(...(childrenByTask.get(child.id) ?? []));
      }
    }
    const expanded = branch && (selectedTaskId === task.id || containsSelection);
    const indicatorLabel = waiting > 0
      ? `${waiting} related task${waiting === 1 ? '' : 's'} waiting`
      : 'Has related tasks';
    return (
      <div key={task.id} className="task-item-wrap">
        <button
          type="button"
          className={`task-item${nested ? ' task-item-dependent' : ''}${task.status === 'completed' ? ' task-item-completed' : ''}`}
          aria-selected={selectedTaskId === task.id}
          aria-expanded={branch ? expanded : undefined}
          onClick={() => onSelectTask(task.id)}
        >
          <div className="task-item-row">
            <div
              className="task-item-id-col"
              title={`${type.label} · ${taskPriorityLabel(task.priority)}`}
            >
              <span className="entity-num">{task.short_id}</span>
              <span className="task-item-swatches">
                <span className={`ta35-type-swatch ${type.swatch}`} aria-hidden="true" />
                <span
                  className={`ta35-priority-swatch ${taskPriorityTone(task.priority)}`}
                  aria-hidden="true"
                />
              </span>
            </div>
            <div className="task-item-main">
              <h3 className="task-item-title">{task.title}</h3>
              <div className="task-item-badges">
                <span className={`badge ${badgeClass(task.status)}`}>
                  <span className="badge-dot" />
                  {statusLabel(task.status)}
                </span>
                {task.blocked ? <span className="badge badge-task-waiting">Blocked</span> : null}
              </div>
            </div>
          </div>
          {branch ? (
            <span
              className={`task-blocks-indicator${waiting > 0 ? ' task-blocks-indicator-waiting' : ''}`}
              role="img"
              aria-label={indicatorLabel}
              title={indicatorLabel}
            />
          ) : null}
        </button>
        {expanded ? (
          <div className="task-deps-rail" role="group" aria-label={`Tasks related to ${task.short_id}`}>
            {children.map((child) => renderTask(child, path))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside className="task-rail live-task-rail" aria-label="Tasks">
      <div className="task-list-scroll">
        {!projectId ? (
          <p className="tasks-empty">Create a project first.</p>
        ) : loading && tasks.length === 0 ? (
          <p className="tasks-empty">Loading tasks…</p>
        ) : visible.length === 0 ? (
          <p className="tasks-empty">No tasks yet.</p>
        ) : (
          <>
            <div className="task-project-items">{open.map((task) => renderTask(task))}</div>
            {completed.length > 0 ? (
              <section className="task-project-group" aria-label="Completed tasks">
                <div className="task-project-head">
                  <span className="entity-label">Completed</span>
                </div>
                <div className="task-project-items">{completed.map((task) => renderTask(task))}</div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

export function LiveTaskDetail({
  projectId,
  projects,
  taskId,
  composing,
  refreshKey,
  remoteUpdatedAt,
  onSelectTask,
  onChanged,
  onCreated,
  onCancelCreate,
}: {
  projectId: string | null;
  projects: Project[];
  taskId: string | null;
  composing: boolean;
  refreshKey: number;
  remoteUpdatedAt: string | null;
  onSelectTask: (taskId: string) => void;
  onChanged: () => void;
  onCreated: (taskId: string) => void;
  onCancelCreate: () => void;
}) {
  const projectName = projects.find((project) => project.id === projectId)?.name ?? 'project';
  if (composing) {
    return (
      <CreateTaskForm
        projectId={projectId}
        projectName={projectName}
        onCreated={onCreated}
        onCancel={onCancelCreate}
      />
    );
  }
  if (!taskId) {
    return (
      <div className="empty-state" style={{ padding: 'var(--space-5)' }}>
        Select a task or create one.
      </div>
    );
  }
  return (
    <TaskEditor
      taskId={taskId}
      refreshKey={refreshKey}
      remoteUpdatedAt={remoteUpdatedAt}
      onSelectTask={onSelectTask}
      onChanged={onChanged}
    />
  );
}

function CreateTaskForm({
  projectId,
  projectName,
  onCreated,
  onCancel,
}: {
  projectId: string | null;
  projectName: string;
  onCreated: (taskId: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parent, setParent] = useState('');
  const [labels, setLabels] = useState<TaskLabelValues>({
    taskType: 'feature',
    priority: 'medium',
    category: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const categorySuggestions = useProjectCategorySuggestions(projectId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          title,
          description,
          task_type: labels.taskType,
          priority: labels.priority,
          category: labels.category.trim() || null,
          ...(parent.trim() ? { parent_id: parent.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { task: Task };
      onCreated(data.task.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="task-detail-pane">
      <form className="task-editor" onSubmit={submit}>
        <label className="form-field">
          <span className="form-label">Title</span>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <TaskLabelCreateFields
          value={labels}
          onChange={setLabels}
          categorySuggestions={categorySuggestions}
        />
        <label className="form-field">
          <span className="form-label">Description</span>
          <textarea
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
          />
        </label>
        <label className="form-field">
          <span className="form-label">Parent task</span>
          <input
            className="form-input"
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            placeholder="Optional short id, e.g. TA-1"
          />
        </label>
        {error ? <p className="form-help">{error}</p> : null}
        <div className="task-editor-actions">
          <button type="submit" className="btn btn-primary" disabled={saving || !projectId}>
            Create task in {projectName}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function displayActor(actor: string): string {
  return actor;
}

function isMine(actor: string, displayName: string | null): boolean {
  if (!displayName) return false;
  return actor.trim().toLowerCase() === displayName.trim().toLowerCase();
}

const dependencySections = [
  { direction: 'blocked_by', label: 'Depends on', addLabel: 'Add prerequisite' },
  { direction: 'blocks', label: 'Blocks', addLabel: 'Add downstream task' },
] as const;
type DependencyDirection = (typeof dependencySections)[number]['direction'];

function DependencyPicker({
  task,
  direction,
  saving,
  onAdd,
  onCancel,
}: {
  task: TaskDetail;
  direction: DependencyDirection;
  saving: boolean;
  onAdd: (id: string) => void;
  onCancel: () => void;
}) {
  const [candidates, setCandidates] = useState<ApiTask[] | null | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<ApiTask | null>(null);
  const resultsId = useId();
  const activeResultRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTasksForProject(task.project_id).then((items) => {
      if (!cancelled) setCandidates(items);
    });
    return () => { cancelled = true; };
  }, [task.project_id]);

  const excluded = new Set([task.id, ...task[direction].map((link) => link.id)]);
  const search = query.trim().toLowerCase();
  const results = (candidates ?? []).filter((candidate) =>
    !excluded.has(candidate.id) && (
      candidate.short_id.toLowerCase().includes(search) || candidate.title.toLowerCase().includes(search)
    ),
  ).sort((left, right) =>
    Number(right.short_id.toLowerCase() === search) - Number(left.short_id.toLowerCase() === search),
  ).slice(0, 12);
  const choice = selected && !excluded.has(selected.id) ? selected : null;
  const activeResult = results[Math.min(activeIndex, results.length - 1)];

  useEffect(() => {
    if (choice) confirmRef.current?.focus();
    else inputRef.current?.focus();
  }, [choice]);

  useEffect(() => {
    activeResultRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeResult?.id]);

  return (
    <form
      className="task-view-detail-block task-dependency-picker"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !saving) {
          event.preventDefault();
          onCancel();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (choice) onAdd(choice.id);
        else if (activeResult) setSelected(activeResult);
      }}
    >
      {choice ? (
        <p className="form-help">
          {direction === 'blocked_by'
            ? <><strong>{task.short_id}</strong> depends on <strong>{choice.short_id}</strong></>
            : <><strong>{choice.short_id}</strong> depends on <strong>{task.short_id}</strong></>}
          {' · '}{choice.title}
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            className="form-input"
            role="combobox"
            aria-label="Find a task in this project"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls={resultsId}
            aria-activedescendant={activeResult ? `${resultsId}-${activeResult.id}` : undefined}
            autoComplete="off"
            placeholder="Search by task ID or title"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (!results.length || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
              event.preventDefault();
              const index = results.indexOf(activeResult);
              const next = index + (event.key === 'ArrowDown' ? 1 : -1);
              setActiveIndex((next + results.length) % results.length);
            }}
          />
          <ul id={resultsId} className="task-dependency-results" role="listbox" aria-label="Matching tasks" hidden={!results.length}>
            {results.map((candidate) => (
              <li
                key={candidate.id}
                id={`${resultsId}-${candidate.id}`}
                ref={candidate === activeResult ? activeResultRef : undefined}
                role="option"
                aria-selected={candidate === activeResult}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSelected(candidate)}
              >
                <span>{candidate.short_id} · {candidate.title}</span>
                <span className={`badge ${badgeClass(candidate.status)}`}>{statusLabel(candidate.status)}</span>
              </li>
            ))}
          </ul>
          {!results.length ? (
            <p className="form-help" role="status">
              {candidates === undefined ? 'Loading tasks…' : candidates === null ? 'Could not load tasks.' : 'No matching tasks to link.'}
            </p>
          ) : null}
        </>
      )}
      <div className="task-dependency-actions">
        {choice ? (
          <>
            <button ref={confirmRef} type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Adding…' : 'Add dependency'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setSelected(null)}>
              Change task
            </button>
          </>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function TaskDependencies({
  task,
  onSelectTask,
  onChanged,
}: {
  task: TaskDetail;
  onSelectTask: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [picker, setPicker] = useState<DependencyDirection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const addButtons = useRef<Partial<Record<DependencyDirection, HTMLButtonElement | null>>>({});

  function closePicker(direction: DependencyDirection) {
    setPicker(null);
    setError(null);
    addButtons.current[direction]?.focus();
  }

  async function save(direction: DependencyDirection, relatedId: string, method: 'POST' | 'DELETE') {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const [dependent, prerequisite] = direction === 'blocked_by' ? [task.id, relatedId] : [relatedId, task.id];
    const path = `/api/tasks/${encodeURIComponent(dependent)}/dependencies`;
    try {
      const res = method === 'POST'
        ? await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ depends_on: prerequisite }),
        })
        : await fetch(`${path}?depends_on=${encodeURIComponent(prerequisite)}`, { method });
      if (!res.ok) throw new Error(await readError(res));
      await onChanged();
      closePicker(direction);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the dependency.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="task-view-detail-block" aria-label="Dependencies">
      <h3 className="form-label task-dependencies-heading">Dependencies</h3>
      {error ? <p className="form-help task-dependency-error" role="alert">{error}</p> : null}
      {dependencySections.map(({ direction, label, addLabel }) => {
        const links = task[direction];
        return (
          <div className="task-view-detail-block" key={direction}>
            <div className="task-view-detail-label-row">
              <span>{label}</span>
              <button
                ref={(button) => { addButtons.current[direction] = button; }}
                className="btn btn-ghost btn-sm"
                type="button"
                aria-expanded={picker === direction}
                onClick={() => {
                  if (savingRef.current) return;
                  setError(null);
                  setPicker((current) => current === direction ? null : direction);
                }}
              >
                {addLabel}
              </button>
            </div>
            {links.length ? (
              <ul className="task-view-statements task-dependency-links">
                {links.map((link) => (
                  <li key={link.id}>
                    <button type="button" className="task-view-blocker" onClick={() => onSelectTask(link.id)}>
                      {link.short_id} · {link.title}
                    </button>
                    <span className={`badge ${badgeClass(link.status)}`}>{statusLabel(link.status)}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`Remove link to ${link.short_id}`}
                      disabled={saving}
                      onClick={() => void save(direction, link.id, 'DELETE')}
                    >
                      Remove link
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {picker === direction ? (
              <DependencyPicker
                task={task}
                direction={direction}
                saving={saving}
                onAdd={(id) => void save(direction, id, 'POST')}
                onCancel={() => closePicker(direction)}
              />
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function TaskEditor({
  taskId,
  refreshKey,
  remoteUpdatedAt,
  onSelectTask,
  onChanged,
}: {
  taskId: string;
  refreshKey: number;
  remoteUpdatedAt: string | null;
  onSelectTask: (taskId: string) => void;
  onChanged: () => void;
}) {
  const person = useSessionPerson();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [briefDraft, setBriefDraft] = useState('');
  const [briefEditing, setBriefEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [waitingForReason, setWaitingForReason] = useState(false);
  const [waitReason, setWaitReason] = useState('');
  const [comment, setComment] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [decisionDraft, setDecisionDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commentSubmittingRef = useRef(false);
  const briefEditingRef = useRef(false);
  const activeTaskIdRef = useRef(taskId);
  const remoteUpdatedAtRef = useRef(remoteUpdatedAt);
  const loadedUpdatedAt = useRef<string | null>(null);
  const requestSeq = useRef(0);
  const readyRef = useRef(false);
  const loadTaskRef = useRef<(seq: number, resetUi: boolean) => Promise<void>>(async () => {});
  briefEditingRef.current = briefEditing;
  activeTaskIdRef.current = taskId;
  remoteUpdatedAtRef.current = remoteUpdatedAt;

  const applyTask = useCallback((next: TaskDetail, resetUi: boolean) => {
    setTask(next);
    loadedUpdatedAt.current = next.updated_at;
    setError(null);
    if (resetUi) {
      setBriefEditing(false);
      setDetailsOpen(false);
      setWaitingForReason(false);
      setBriefDraft(next.description);
      return;
    }
    if (!briefEditingRef.current) setBriefDraft(next.description);
  }, []);

  const loadTask = useCallback(
    async (seq: number, resetUi: boolean) => {
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`);
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as { task: TaskDetail };
        if (seq !== requestSeq.current) return;
        applyTask(data.task, resetUi);
        readyRef.current = true;
        const remote = remoteUpdatedAtRef.current;
        if (resetUi && remote && remote !== data.task.updated_at) {
          const follow = ++requestSeq.current;
          void loadTaskRef.current(follow, false);
        }
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load task');
      }
    },
    [applyTask, taskId],
  );
  loadTaskRef.current = loadTask;

  useEffect(() => {
    readyRef.current = false;
    const seq = ++requestSeq.current;
    void loadTask(seq, true);
    return () => {
      requestSeq.current += 1;
    };
  }, [taskId, refreshKey, loadTask]);

  useEffect(() => {
    if (!remoteUpdatedAt || !readyRef.current) return;
    if (remoteUpdatedAt === loadedUpdatedAt.current) return;
    const seq = ++requestSeq.current;
    void loadTask(seq, false);
  }, [remoteUpdatedAt, taskId, loadTask]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const snap = () => {
      el.scrollTop = el.scrollHeight;
    };
    snap();
    const frame = requestAnimationFrame(snap);
    return () => cancelAnimationFrame(frame);
  }, [task?.id, task?.activity.length]);

  async function patchTask(body: Record<string, string | null>) {
    setError(null);
    const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(await readError(res));
      return false;
    }
    onChanged();
    return true;
  }

  async function patchLabels(next: TaskLabelValues) {
    await patchTask({
      task_type: next.taskType,
      priority: next.priority,
      category: next.category.trim() || null,
    });
  }

  async function changeStatus(next: TaskStatus) {
    if (!task || next === task.status) {
      setWaitingForReason(false);
      return;
    }
    if (next === 'waiting') {
      setWaitingForReason(true);
      return;
    }
    setWaitingForReason(false);
    await patchTask({ status: next });
  }

  async function confirmWaiting(event: FormEvent) {
    event.preventDefault();
    if (!waitReason.trim()) {
      setError('Add a reason when setting a task to waiting.');
      return;
    }
    const ok = await patchTask({ status: 'waiting', wait_reason: waitReason.trim() });
    if (ok) {
      setWaitReason('');
      setWaitingForReason(false);
    }
  }

  async function updateBrief() {
    if (!task) return;
    const next = briefDraft.trim();
    setBriefEditing(false);
    if (next === task.description) return;
    const ok = await patchTask({ description: next });
    if (!ok) setBriefEditing(true);
  }

  async function sendComment(event: FormEvent) {
    event.preventDefault();
    if (commentSubmittingRef.current || !comment.trim()) return;
    commentSubmittingRef.current = true;
    setCommentBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: comment }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      setComment('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      commentSubmittingRef.current = false;
      setCommentBusy(false);
    }
  }

  async function addDecision(event: FormEvent) {
    event.preventDefault();
    const choice = decisionDraft.trim();
    if (!choice) return;
    setError(null);
    const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice }),
    });
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    setDecisionDraft('');
    onChanged();
  }

  async function removeDecision(decisionId: string) {
    setError(null);
    const res = await fetch(
      `/api/tasks/${encodeURIComponent(taskId)}/decisions?decision_id=${encodeURIComponent(decisionId)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    onChanged();
  }

  const categorySuggestions = useProjectCategorySuggestions(task?.project_id, refreshKey);

  if (!task) {
    return (
      <div className="empty-state" style={{ padding: 'var(--space-5)' }}>
        {error ?? 'Loading task…'}
      </div>
    );
  }

  const headerOpen = detailsOpen || waitingForReason || Boolean(error);

  const labelValues: TaskLabelValues = {
    taskType: task.task_type,
    priority: task.priority,
    category: task.category ?? '',
  };

  return (
    <div className="task-view" aria-label="Task detail">
      <header className={`task-view-head${headerOpen ? ' is-open' : ''} has-label-pills`}>
        <div className="task-view-top">
          <span className="entity-num">{task.short_id}</span>
          <h2 className="task-detail-title">{task.title}</h2>
          <span className="task-view-inline-meta">{task.assignee || 'Unassigned'}</span>
          {task.blocked_by.length > 0 ? (
            <span className="task-view-inline-meta">
              Blocked by{' '}
              {task.blocked_by.map((dep, index) => (
                <span key={dep.id}>
                  {index > 0 ? ', ' : null}
                  <button type="button" className="task-view-blocker" onClick={() => onSelectTask(dep.id)}>
                    {dep.short_id}
                  </button>
                </span>
              ))}
            </span>
          ) : null}
          <TaskLabelPills
            value={labelValues}
            onChange={patchLabels}
            categorySuggestions={categorySuggestions}
          />
          <span className="task-view-top-actions">
            <button
              type="button"
              className="task-view-details-toggle"
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((open) => !open)}
            >
              Details
            </button>
            <select
              className={`badge ${badgeClass(waitingForReason ? 'waiting' : task.status)} task-view-status-badge`}
              aria-label="Status"
              value={waitingForReason ? 'waiting' : task.status}
              onChange={(event) => void changeStatus(event.target.value as TaskStatus)}
            >
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {statusLabel(item)}
                </option>
              ))}
            </select>
          </span>
        </div>
        {waitingForReason ? (
          <form className="task-view-wait" onSubmit={(event) => void confirmWaiting(event)}>
            <input
              className="form-input"
              value={waitReason}
              onChange={(event) => setWaitReason(event.target.value)}
              placeholder="Why is this waiting?"
              aria-label="Why is this waiting?"
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Set waiting
            </button>
          </form>
        ) : null}
        {detailsOpen ? (
          <div className="task-view-details">
            <div className="task-view-detail-block">
              <div className="task-view-detail-label-row">
                <span className="form-label">Brief</span>
                {briefEditing ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void updateBrief()}>
                    Update
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setBriefDraft(task.description);
                      setBriefEditing(true);
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
              {briefEditing ? (
                <textarea
                  className="form-textarea"
                  rows={6}
                  aria-label="Brief"
                  value={briefDraft}
                  onChange={(event) => setBriefDraft(event.target.value)}
                />
              ) : (
                <div className="task-view-brief">{task.description || 'No brief yet.'}</div>
              )}
            </div>
            {task.id === taskId ? (
              <TaskDependencies
                key={task.id}
                task={task}
                onSelectTask={onSelectTask}
                onChanged={async () => {
                  if (activeTaskIdRef.current === task.id) {
                    await loadTaskRef.current(++requestSeq.current, false);
                  }
                }}
              />
            ) : null}
            <div className="task-view-detail-block">
              <span className="form-label">Decisions</span>
              <ul className="task-view-statements">
                {task.decisions.map((decision) => (
                  <li key={decision.id}>
                    <span>{decision.choice}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void removeDecision(decision.id)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <form className="task-view-statement-add" onSubmit={(event) => void addDecision(event)}>
                <input
                  className="form-input"
                  value={decisionDraft}
                  onChange={(event) => setDecisionDraft(event.target.value)}
                  placeholder="Decision"
                  aria-label="Decision"
                />
                <button type="submit" className="btn btn-ghost btn-sm">
                  Add
                </button>
              </form>
            </div>
          </div>
        ) : null}
        {error ? <p className="form-help task-view-error">{error}</p> : null}
      </header>
      <div className="task-view-feed task-view-sides">
        <div className="chat-scroll" ref={scrollRef}>
          {task.activity.map((item, index) => {
            if (item.type === 'comment') {
              return (
                <ChatMessage
                  key={`${item.created_at}-${index}`}
                  className={isMine(item.actor, person?.displayName ?? null) ? 'task-view-mine' : 'task-view-agent'}
                  header={<>{displayActor(item.actor)} · {new Date(item.created_at).toLocaleString()}</>}
                >
                  <MarkdownMessage text={item.text} />
                </ChatMessage>
              );
            }
            if (item.type === 'status_change') {
              return (
                <ChatMessage key={`${item.created_at}-${index}`}>
                  {displayActor(item.actor)} moved <strong>{statusLabel(item.from)}</strong> →{' '}
                  <strong>{statusLabel(item.to)}</strong>
                </ChatMessage>
              );
            }
            return (
              <ChatMessage key={`${item.created_at}-${index}`}>
                {displayActor(item.actor)} {item.summary}
                {item.detail ? (
                  <div
                    className={`task-view-action-detail${
                      item.summary === 'set the brief' || item.summary === 'updated the brief'
                        ? ' task-view-brief-detail'
                        : ''
                    }`}
                  >
                    {item.summary === 'set the brief' || item.summary === 'updated the brief' ? (
                      <MarkdownMessage text={item.detail} />
                    ) : (
                      item.detail
                    )}
                  </div>
                ) : null}
              </ChatMessage>
            );
          })}
        </div>
        <footer className="task-compose-footer">
          <ChatCommentComposer
            id="live-task-comment"
            value={comment}
            onChange={setComment}
            onSubmit={sendComment}
            busy={commentBusy}
          />
        </footer>
      </div>
    </div>
  );
}
