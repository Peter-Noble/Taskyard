'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { Project, Task, TaskDetail, TaskStatus } from '@taskyard/protocol';
import { useSessionPerson } from '@/components/providers';
import {
  TaskLabelCreateFields,
  TaskLabelPills,
  type TaskLabelValues,
} from '@/components/task-label-fields';
import { taskPassesRailFilter, type TaskRailFilterState } from '@/components/task-rail-filter';
import { taskPriorityLabel, taskPriorityTone, taskTypeMeta } from '@/lib/task-labels';

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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const source = new EventSource(`/api/tasks/stream?project_id=${encodeURIComponent(projectId)}`);
    source.onmessage = (event) => {
      if (cancelled) return;
      try {
        const next = JSON.parse(event.data) as Task[];
        setTasks(Array.isArray(next) ? next : []);
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

  const visible = filter
    ? tasks.filter((task) => taskPassesRailFilter(task, filter))
    : tasks.filter((task) => task.status !== 'cancelled');
  const ids = new Set(visible.map((task) => task.id));
  const roots = visible.filter((task) => !task.parent_id || !ids.has(task.parent_id));
  const open = roots.filter((task) => task.status !== 'completed');
  const completed = roots.filter((task) => task.status === 'completed');
  const childrenOf = (id: string) => visible.filter((task) => task.parent_id === id);

  function renderTask(task: Task, nested = false) {
    const type = taskTypeMeta(task.task_type);
    return (
      <div key={task.id} className="task-item-wrap">
        <button
          type="button"
          className={`task-item${nested ? ' task-item-dependent' : ''}${task.status === 'completed' ? ' task-item-completed' : ''}`}
          aria-selected={selectedTaskId === task.id}
          onClick={() => onSelectTask(task.id)}
        >
          <div className="task-item-row">
            <div
              className="task-item-id-col"
              title={`${type.label} · ${taskPriorityLabel(task.priority)}`}
            >
              <span className={`task-item-priority ${taskPriorityTone(task.priority)}`}>
                {taskPriorityLabel(task.priority)}
              </span>
              <span className="entity-num">{task.short_id}</span>
              <span className={`ta35-type-swatch ${type.swatch}`} aria-hidden="true" />
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
        </button>
        {childrenOf(task.id).map((child) => renderTask(child, true))}
      </div>
    );
  }

  return (
    <aside className="task-rail" aria-label="Tasks">
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
  if (composing) {
    return (
      <CreateTaskForm
        projectId={projectId}
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
  onCreated,
  onCancel,
}: {
  projectId: string | null;
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
        <TaskLabelCreateFields value={labels} onChange={setLabels} />
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
            Create task
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
  const [decisionDraft, setDecisionDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const briefEditingRef = useRef(false);
  const remoteUpdatedAtRef = useRef(remoteUpdatedAt);
  const loadedUpdatedAt = useRef<string | null>(null);
  const requestSeq = useRef(0);
  const readyRef = useRef(false);
  const loadTaskRef = useRef<(seq: number, resetUi: boolean) => Promise<void>>(async () => {});
  briefEditingRef.current = briefEditing;
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
    if (!comment.trim()) return;
    setError(null);
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
          <TaskLabelPills value={labelValues} onChange={patchLabels} />
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
                <article
                  key={`${item.created_at}-${index}`}
                  className={`chat-msg ${isMine(item.actor, person?.displayName ?? null) ? 'task-view-mine' : 'task-view-agent'}`}
                >
                  <header className="chat-msg-head">
                    {displayActor(item.actor)} · {new Date(item.created_at).toLocaleString()}
                  </header>
                  <div className="chat-msg-body">{item.text}</div>
                </article>
              );
            }
            if (item.type === 'status_change') {
              return (
                <article key={`${item.created_at}-${index}`} className="chat-msg chat-msg-system">
                  <div className="chat-msg-body">
                    {displayActor(item.actor)} moved <strong>{statusLabel(item.from)}</strong> →{' '}
                    <strong>{statusLabel(item.to)}</strong>
                  </div>
                </article>
              );
            }
            return (
              <article key={`${item.created_at}-${index}`} className="chat-msg chat-msg-system">
                <div className="chat-msg-body">
                  {displayActor(item.actor)} {item.summary}
                  {item.detail ? (
                    <div
                      className={`task-view-action-detail${
                        item.summary === 'set the brief' || item.summary === 'updated the brief'
                          ? ' task-view-brief-detail'
                          : ''
                      }`}
                    >
                      {item.detail}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        <footer className="task-compose-footer">
          <form className="chat-compose" onSubmit={(event) => void sendComment(event)}>
            <label className="visually-hidden" htmlFor="live-task-comment">
              Add comment
            </label>
            <input
              id="live-task-comment"
              className="chat-compose-input"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a comment…"
            />
            <button type="submit" className="btn btn-primary chat-compose-send">
              Comment
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
