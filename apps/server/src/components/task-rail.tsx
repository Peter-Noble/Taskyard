'use client';

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

type TaskRailProps = {
  enabled: boolean;
  threadSlug: string;
  selectedTaskId: string | null;
  centerMode: 'chat' | 'task';
  onSelectTask: (taskId: string) => void;
  onMarkReady: (taskId: string) => void;
};

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

function TaskDependents({
  parentTask,
  depth,
  selectedTaskId,
  centerMode,
  onSelect,
}: {
  parentTask: DashboardTask;
  depth: number;
  selectedTaskId: string | null;
  centerMode: 'chat' | 'task';
  onSelect: (id: string) => void;
}) {
  const dependents = getDependentTasks(parentTask);
  if (!dependents.length) return null;

  return (
    <div className="task-deps-rail" data-depth={depth} aria-label={`Tasks blocked by ${parentTask.num}`}>
      {dependents.map((dep) => {
        const nested = shouldExpandDependents(dep, centerMode, selectedTaskId);
        return (
          <div key={dep.id} className="task-item-wrap task-item-wrap-nested">
            <TaskListItem
              task={dep}
              selected={selectedTaskId === dep.id}
              dependent
              onSelect={onSelect}
            />
            {nested ? (
              <TaskDependents
                parentTask={dep}
                depth={depth + 1}
                selectedTaskId={selectedTaskId}
                centerMode={centerMode}
                onSelect={onSelect}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function TaskRail({
  enabled,
  threadSlug,
  selectedTaskId,
  centerMode,
  onSelectTask,
  onMarkReady,
}: TaskRailProps) {
  if (!enabled) {
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
            {visibleTasks.map((task) => {
              const related = key === activeProject;
              const showDeps = shouldExpandDependents(task, centerMode, selectedTaskId);
              return (
                <div key={task.id} className="task-item-wrap">
                  <TaskListItem
                    task={task}
                    selected={selectedTaskId === task.id}
                    related={related}
                    onSelect={onSelectTask}
                  />
                  {showDeps ? (
                    <TaskDependents
                      parentTask={task}
                      depth={1}
                      selectedTaskId={selectedTaskId}
                      centerMode={centerMode}
                      onSelect={onSelectTask}
                    />
                  ) : null}
                </div>
              );
            })}
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
      const role = activityRole(ev);
      return (
        <article key={i} className={`chat-msg chat-msg-${role}`}>
          <header className="chat-msg-head">
            {ev.actor} · {ev.time}
          </header>
          <div className="chat-msg-body">{ev.text}</div>
        </article>
      );
    }
    if (ev.type === 'status') {
      return (
        <article key={i} className="chat-msg chat-msg-system">
          <div className="chat-msg-body">
            {ev.actor} moved <strong>{ev.from}</strong> → <strong>{ev.to}</strong> · {ev.time}
          </div>
        </article>
      );
    }
    if (ev.type === 'attachment') {
      return (
        <article key={i} className="chat-msg chat-msg-system">
          <div className="chat-msg-body">
            Attached <strong>{ev.name}</strong> ({ev.size}) · {ev.actor} · {ev.time}
          </div>
        </article>
      );
    }
    if (ev.type === 'dependency') {
      return (
        <article key={i} className="chat-msg chat-msg-system">
          <div className="chat-msg-body">
            {ev.text} · {ev.time}
          </div>
        </article>
      );
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
          <article className="chat-msg chat-msg-assistant task-desc-msg">
            <header className="chat-msg-head">Description</header>
            <div className="chat-msg-body">{task.description}</div>
          </article>
          <div className="feed-messages" aria-label="Activity">
            {renderActivity(task.activity)}
          </div>
        </div>
        <footer className="task-compose-footer">
          <div className="chat-compose">
            <label className="visually-hidden" htmlFor="task-comment-input">
              Add comment
            </label>
            <input type="text" id="task-comment-input" className="chat-compose-input" placeholder="Add a comment…" />
            <button type="button" className="btn btn-primary chat-compose-send">
              Comment
            </button>
          </div>
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
