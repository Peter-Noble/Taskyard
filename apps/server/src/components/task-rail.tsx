'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  type DashboardTask,
  PROJECT_ORDER,
  PROJECTS,
  collectShownDependentIds,
  findTask,
  getDependentTasks,
  isTaskBlocked,
  shouldExpandDependents,
  showsReadyForAgentAction,
  taskHasOpenDependents,
  taskStatusBadgeClass,
  threadProjectKey,
} from '@/lib/dashboard-tasks';
import { fetchTasksForProject, type ApiTask } from '@/lib/tasks-api';
import { ChatCommentComposer, ChatMessage } from '@/components/chat-message';
import { MarkdownMessage } from '@/components/markdown-message';

type TaskRailProps = {
  /** When true, render design fixtures from dashboard-tasks.ts */
  useFixtures: boolean;
  attentionPrototype?: boolean;
  threadSlug: string;
  projectId: string | null;
  selectedTaskId: string | null;
  centerMode: 'chat' | 'task';
  onSelectTask: (taskId: string) => void;
  onMarkReady: (taskId: string) => void;
};

function apiStatusLabel(status: ApiTask['status']): string {
  switch (status) {
    case 'backlog':
      return 'Backlog';
    case 'ready':
      return 'Ready for agent';
    case 'in_progress':
      return 'In progress';
    case 'review':
      return 'Ready to review';
    case 'merge':
      return 'Ready to merge';
    case 'waiting':
      return 'Waiting for user';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function apiStatusToRail(status: ApiTask['status']): DashboardTask['status'] {
  switch (status) {
    case 'in_progress':
      return 'in-progress';
    case 'ready':
      return 'ready';
    case 'review':
      return 'review';
    case 'merge':
      return 'merge';
    case 'waiting':
      return 'waiting';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'completed';
    default:
      return 'backlog';
  }
}

function mapApiTask(task: ApiTask, index: number): DashboardTask {
  return {
    id: task.id,
    num: task.id.replace(/^ty-/, '') || String(index + 1),
    title: task.title,
    status: apiStatusToRail(task.status),
    statusLabel: apiStatusLabel(task.status),
    assignee: task.assignee ?? '—',
    created: new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    description: task.description,
    blockedBy: [],
    blocks: [],
    activity: [],
  };
}

function TaskStatusBadge({ task }: { task: DashboardTask }) {
  return (
    <span className={`badge ${taskStatusBadgeClass(task.status)}`}>
      <span className="badge-dot" />
      {task.statusLabel}
    </span>
  );
}

function TaskTags({ task }: { task: DashboardTask }) {
  const tags = task.tags ?? [];
  if (!tags.length) return null;
  return (
    <div className="task-item-tags">
      {tags.map((t) => (
        <span key={t} className="tag-chip tag-chip-sm">
          {t}
        </span>
      ))}
    </div>
  );
}

function TaskBlocksIndicator({ task }: { task: DashboardTask }) {
  if (!taskHasOpenDependents(task)) return null;
  const count = getDependentTasks(task).length;
  return (
    <span
      className="task-blocks-indicator"
      title={`Blocks ${count} task${count > 1 ? 's' : ''}`}
      aria-label={`Blocks ${count} dependent task${count > 1 ? 's' : ''}`}
    />
  );
}

function TaskListItem({
  task,
  selected,
  related,
  dependent,
  onSelect,
}: {
  task: DashboardTask;
  selected: boolean;
  related?: boolean;
  dependent?: boolean;
  onSelect: (id: string) => void;
}) {
  const classes = ['task-item', related ? 'task-item-related' : '', dependent ? 'task-item-dependent' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} data-task-id={task.id} aria-selected={selected} onClick={() => onSelect(task.id)}>
      <div className="task-item-row">
        <span className="entity-num" aria-hidden="true">
          {task.num}
        </span>
        <div className="task-item-main">
          <div className="task-item-title-row">
            <h3 className="task-item-title">{task.title}</h3>
          </div>
          <div className="task-item-badges">
            <TaskStatusBadge task={task} />
          </div>
          <TaskTags task={task} />
        </div>
      </div>
      <TaskBlocksIndicator task={task} />
    </button>
  );
}

type AttentionBranches = {
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
};

// The prototype uses fixture requests explicitly labeled as waiting for a user.
function collectInputRequests(task: DashboardTask) {
  const requests = new Set<string>();
  const branches = new Set<string>();
  const path = new Set<string>();

  function visit(parent: DashboardTask): boolean {
    path.add(parent.id);
    let hasRequests = false;
    for (const child of getDependentTasks(parent)) {
      if (path.has(child.id) || child.status === 'completed') continue;
      const needsInput = child.status === 'waiting' && child.statusLabel === 'Waiting for user';
      if (needsInput) requests.add(child.id);
      if (visit(child) || needsInput) hasRequests = true;
    }
    path.delete(parent.id);
    if (hasRequests) branches.add(parent.id);
    return hasRequests;
  }

  visit(task);
  return { count: requests.size, branches };
}

function TaskBranch({
  task,
  related,
  depth,
  selectedTaskId,
  centerMode,
  onSelect,
  attention,
}: {
  task: DashboardTask;
  related?: boolean;
  depth: number;
  selectedTaskId: string | null;
  centerMode: 'chat' | 'task';
  onSelect: (id: string) => void;
  attention?: AttentionBranches;
}) {
  const expanded = attention?.expanded[task.id] ?? shouldExpandDependents(task, centerMode, selectedTaskId);
  const input = attention && collectInputRequests(task);
  const showControl = Boolean(input && input.count);

  function toggleAttentionBranch() {
    if (!attention || !input) return;
    attention.setExpanded((previous) => {
      if (expanded) return { ...previous, [task.id]: false };
      const next = { ...previous };
      for (const branchId of input.branches) next[branchId] = true;
      return next;
    });
  }

  return (
    <div className={`task-item-wrap${depth ? ' task-item-wrap-nested' : ''}${showControl ? ' ta-28-attention-branch' : ''}`}>
      <TaskListItem
        task={task}
        selected={selectedTaskId === task.id}
        related={related}
        dependent={depth > 0}
        onSelect={onSelect}
      />
      {input && showControl ? (
        <button
          type="button"
          className={`badge ta-28-attention-toggle${expanded ? '' : ' badge-task-waiting'}`}
          aria-expanded={expanded}
          onClick={toggleAttentionBranch}
        >
          {expanded ? (
            <>Collapse <span aria-hidden="true">⌃</span></>
          ) : (
            <><span aria-hidden="true">!</span> {input.count} {input.count === 1 ? 'needs' : 'need'} input <span aria-hidden="true">⌄</span></>
          )}
        </button>
      ) : null}
      {expanded ? (
        <div className="task-deps-rail" data-depth={depth + 1} aria-label={`Tasks blocked by ${task.num}`}>
          {getDependentTasks(task).map((dependent) => (
            <TaskBranch
              key={dependent.id}
              task={dependent}
              depth={depth + 1}
              selectedTaskId={selectedTaskId}
              centerMode={centerMode}
              onSelect={onSelect}
              attention={attention}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TaskRail({
  useFixtures,
  attentionPrototype,
  threadSlug,
  projectId,
  selectedTaskId,
  centerMode,
  onSelectTask,
  onMarkReady,
}: TaskRailProps) {
  const [apiTasks, setApiTasks] = useState<DashboardTask[] | null>(null);
  const [apiChecked, setApiChecked] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (useFixtures || !projectId) {
      setApiTasks(null);
      setApiChecked(false);
      return;
    }

    let cancelled = false;
    setApiChecked(false);
    void fetchTasksForProject(projectId).then((tasks) => {
      if (cancelled) return;
      setApiChecked(true);
      if (tasks == null) {
        // /api/tasks not deployed yet — fixture rail stays empty until backend lands (docs/mvp.md §4.2).
        setApiTasks(null);
        return;
      }
      setApiTasks(tasks.map(mapApiTask));
    });

    return () => {
      cancelled = true;
    };
  }, [useFixtures, projectId]);

  if (!useFixtures) {
    if (!apiChecked && projectId) {
      return (
        <aside className="task-rail" aria-label="Tasks">
          <div className="task-list-scroll">
            <p className="tasks-empty">Loading tasks…</p>
          </div>
        </aside>
      );
    }

    if (apiTasks?.length) {
      const visibleTasks = apiTasks.filter((task) => task.status !== 'completed');
      return (
        <aside className="task-rail" aria-label="Tasks">
          <div className="task-list-scroll">
            {visibleTasks.length ? (
              <section className="task-project-group" aria-label="Project tasks">
                <div className="task-project-items">
                  {visibleTasks.map((task) => (
                    <div key={task.id} className="task-item-wrap">
                      <TaskListItem
                        task={task}
                        selected={selectedTaskId === task.id}
                        onSelect={onSelectTask}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="tasks-empty">No open tasks.</p>
            )}
          </div>
        </aside>
      );
    }

    return (
      <aside className="task-rail" aria-label="Tasks">
        <div className="task-list-scroll">
          <p className="tasks-empty">No tasks yet.</p>
        </div>
      </aside>
    );
  }

  const activeProject = threadProjectKey(threadSlug);
  const shownAsDependent = collectShownDependentIds(centerMode, selectedTaskId);

  const groups = PROJECT_ORDER.filter((key) => PROJECTS[key]?.tasks.length)
    .map((key) => {
      const project = PROJECTS[key];
      const visibleTasks = project.tasks.filter(
        (task) => task.status !== 'completed' && !isTaskBlocked(task) && !shownAsDependent.has(task.id),
      );
      if (!visibleTasks.length) return null;

      return (
        <section key={key} className="task-project-group" aria-label={project.name}>
          <div className="task-project-head">
            <span className="entity-label">{project.name}</span>
          </div>
          <div className="task-project-items">
            {visibleTasks.map((task) => (
              <TaskBranch
                key={task.id}
                task={task}
                depth={0}
                related={key === activeProject}
                selectedTaskId={selectedTaskId}
                centerMode={centerMode}
                onSelect={onSelectTask}
                attention={attentionPrototype ? { expanded, setExpanded } : undefined}
              />
            ))}
          </div>
        </section>
      );
    })
    .filter(Boolean);

  return (
    <aside className="task-rail" aria-label="Tasks">
      <div className="task-list-scroll">
        {groups.length ? groups : <p className="tasks-empty">No tasks yet.</p>}
      </div>
    </aside>
  );
}

export function TaskDetailHeader({
  taskId,
  onMarkReady,
}: {
  taskId: string;
  onMarkReady: (taskId: string) => void;
}) {
  const found = findTask(taskId);
  if (!found) return null;
  const { task, project } = found;

  return (
    <>
      <div className="stream-task-title-row">
        <span className="entity-num" aria-hidden="true">
          {task.num}
        </span>
        <h2 className="stream-title stream-task-title">{task.title}</h2>
        {showsReadyForAgentAction(task) ? (
          <button
            type="button"
            className="btn btn-primary btn-ready-agent"
            data-task-id={task.id}
            aria-label={`Mark ${task.title} ready for agent`}
            onClick={() => onMarkReady(task.id)}
          >
            Ready for agent
          </button>
        ) : null}
        <TaskStatusBadge task={task} />
      </div>
      <p className="stream-sub stream-task-sub">
        <span className="task-header-project">{project.name}</span> · {task.assignee} · opened {task.created}
      </p>
    </>
  );
}

function activityRole(ev: { type: string; actor: string }): 'user' | 'assistant' | 'system' {
  if (ev.type !== 'comment') return 'system';
  const actor = ev.actor.toLowerCase();
  if (actor === 'peter' || actor === 'you') return 'user';
  return 'assistant';
}

function renderActivity(events: DashboardTask['activity']) {
  return events.map((ev, i) => {
    if (ev.type === 'comment') {
      return (
        <ChatMessage key={i} role={activityRole(ev)} header={<>{ev.actor} · {ev.time}</>}>
          <MarkdownMessage text={ev.text} />
        </ChatMessage>
      );
    }
    if (ev.type === 'status') {
      return (
        <ChatMessage key={i}>
          {ev.actor} moved <strong>{ev.from}</strong> → <strong>{ev.to}</strong> · {ev.time}
        </ChatMessage>
      );
    }
    if (ev.type === 'attachment') {
      return (
        <ChatMessage key={i}>
          Attached <strong>{ev.name}</strong> ({ev.size}) · {ev.actor} · {ev.time}
        </ChatMessage>
      );
    }
    if (ev.type === 'dependency') {
      return <ChatMessage key={i}>{ev.text} · {ev.time}</ChatMessage>;
    }
    return null;
  });
}

export function TaskDetailPane({
  taskId,
  onSelectTask,
}: {
  taskId: string;
  onSelectTask: (taskId: string) => void;
}) {
  const [comment, setComment] = useState('');
  const found = findTask(taskId);
  if (!found) return null;
  const { task, project } = found;

  const depsBlocked =
    task.blockedBy.length > 0 ? (
      <div className="task-deps-group">
        <span className="task-deps-label">Blocked by</span>
        {task.blockedBy.map((d) => (
          <button key={d.id} type="button" className="task-dep-chip" data-task-id={d.id} onClick={() => onSelectTask(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
    ) : null;

  const depsBlocks =
    task.blocks.length > 0 ? (
      <div className="task-deps-group">
        <span className="task-deps-label">Blocks</span>
        {task.blocks.map((d) => (
          <button key={d.id} type="button" className="task-dep-chip" data-task-id={d.id} onClick={() => onSelectTask(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
    ) : null;

  const depsSection =
    depsBlocked || depsBlocks ? (
      <section className="task-deps" aria-label="Dependencies">
        {depsBlocked}
        {depsBlocks}
      </section>
    ) : null;

  return (
    <div className="task-detail-pane" aria-label="Task detail">
      <div className="chat-thread task-detail-feed">
        <div className="chat-scroll task-detail-scroll">
          <dl className="task-meta-grid task-meta-grid-compact" aria-label="Task metadata">
            <div>
              <dt>Project</dt>
              <dd>
                {project.name} <span className="task-meta-mono">{project.repo}</span>
              </dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>{task.assignee}</dd>
            </div>
            <div>
              <dt>Opened</dt>
              <dd>{task.created}</dd>
            </div>
            <div className="task-meta-tags">
              <dt>Tags</dt>
              <dd>
                {(task.tags ?? []).length ? (
                  (task.tags ?? []).map((t) => (
                    <span key={t} className="tag-chip tag-chip-sm">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="task-tags-empty">No tags yet</span>
                )}
              </dd>
            </div>
          </dl>
          {depsSection}
          <ChatMessage role="assistant" className="chat-msg-assistant task-desc-msg" header="Description">
            {task.description}
          </ChatMessage>
          <div className="feed-messages" aria-label="Activity">
            {renderActivity(task.activity)}
          </div>
        </div>
        <footer className="task-compose-footer">
          <ChatCommentComposer
            id="task-comment-input"
            value={comment}
            onChange={setComment}
            onSubmit={(event) => event.preventDefault()}
          />
        </footer>
      </div>
    </div>
  );
}

export function markTaskReadyForAgent(taskId: string): void {
  const found = findTask(taskId);
  if (!found) return;
  const { task } = found;
  if (!showsReadyForAgentAction(task)) return;
  const prev = task.statusLabel;
  task.status = 'ready';
  task.statusLabel = 'Ready for agent';
  task.activity.unshift({
    type: 'status',
    actor: 'Peter',
    from: prev,
    to: 'Ready for agent',
    time: 'Just now',
  });
}
