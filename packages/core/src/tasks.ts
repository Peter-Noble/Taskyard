import { projects, taskActivity, taskDecisions, taskDependencies, tasks } from '@taskyard/db';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { TaskyardDb } from '@taskyard/db';
import type {
  AddTaskCommentRequest,
  AddTaskDecisionRequest,
  CreateTaskRequest,
  DecisionStatus,
  Task,
  TaskActivity,
  TaskDecision,
  TaskDetail,
  TaskLink,
  TaskStatus,
  UpdateTaskRequest,
} from '@taskyard/protocol';
import { formatTask, formatTaskActivity, formatTaskChild } from './format.js';
import { getProjectById } from './projects.js';
import { TASK_CLI_CONTRACT } from './task-cli-contract.js';

export { TASK_CLI_CONTRACT };

export class TaskError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'TaskError';
    this.statusCode = statusCode;
  }
}

const TASK_STATUSES: TaskStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'review',
  'merge',
  'waiting',
  'completed',
  'cancelled',
];

const OPEN_DEPENDENCY_STATUSES: TaskStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'review',
  'merge',
  'waiting',
];

export function taskPrefixFromName(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let prefix: string;
  if (words.length >= 2) {
    prefix = `${words[0]![0]}${words[1]![0]}`;
  } else if (words[0]) {
    const letters = words[0].replace(/[^A-Za-z]/g, '');
    prefix = (letters.slice(0, 2) || 'T').toUpperCase();
  } else {
    prefix = 'T';
  }
  prefix = prefix.toUpperCase();
  if (prefix.length < 2) prefix = `${prefix}X`.slice(0, 2);
  return prefix;
}

export function appendTaskCliContract(prompt: string): string {
  return `${prompt.trim()}\n\n${TASK_CLI_CONTRACT}`;
}

export function buildPromptFromTask(task: {
  short_id?: string;
  title: string;
  description: string;
}): string {
  const heading = task.short_id ? `# Task ${task.short_id}: ${task.title}` : `# Task: ${task.title}`;
  const parts = [heading];
  if (task.description.trim()) {
    parts.push('', task.description.trim());
  }
  return parts.join('\n');
}

export function composeThreadPrompt(
  userPrompt: string | undefined,
  task: { short_id?: string; title: string; description: string } | null,
): string {
  const base = userPrompt?.trim()
    ? userPrompt.trim()
    : task
      ? buildPromptFromTask(task)
      : '';
  if (!base) return '';
  // D-002
  return appendTaskCliContract(base);
}

function assertTaskStatus(status: string): TaskStatus {
  if (!TASK_STATUSES.includes(status as TaskStatus)) {
    throw new TaskError(`Invalid status: ${status}`);
  }
  return status as TaskStatus;
}

function getTaskRow(db: TaskyardDb, idOrShort: string) {
  const key = idOrShort.trim();
  const byId = db.select().from(tasks).where(eq(tasks.id, key)).get();
  if (byId) return byId;
  const byShort = db.select().from(tasks).where(eq(tasks.shortId, key)).get();
  if (byShort) return byShort;
  return db.select().from(tasks).where(eq(tasks.shortId, key.toUpperCase())).get();
}

function recordChange(
  db: TaskyardDb,
  taskId: string,
  actor: string,
  summary: string,
  detail?: string,
  timestamp?: Date,
) {
  db.insert(taskActivity)
    .values({
      taskId,
      kind: 'change',
      actor,
      payload: JSON.stringify(detail ? { summary, detail } : { summary }),
      ...(timestamp ? { timestamp } : {}),
    })
    .run();
}

const BRIEF_CHANGE_SUMMARIES = new Set(['set the brief', 'updated the brief']);

function hasBriefEvent(db: TaskyardDb, taskId: string, brief: string): boolean {
  const rows = db.select().from(taskActivity).where(eq(taskActivity.taskId, taskId)).all();
  return rows.some((row) => {
    if (row.kind !== 'change') return false;
    try {
      const payload = JSON.parse(row.payload) as { summary?: unknown; detail?: unknown };
      return (
        typeof payload.summary === 'string' &&
        BRIEF_CHANGE_SUMMARIES.has(payload.summary) &&
        typeof payload.detail === 'string' &&
        payload.detail.trim() === brief
      );
    } catch {
      return false;
    }
  });
}

/** Older tasks stored a brief without a history entry. Record the current text once, at creation time. */
function ensureBriefHistory(db: TaskyardDb, row: typeof tasks.$inferSelect) {
  const brief = (row.description ?? '').trim();
  if (!brief || hasBriefEvent(db, row.id, brief)) return;
  recordChange(db, row.id, 'user', 'set the brief', brief, row.createdAt ?? undefined);
}

function listRecentActivity(db: TaskyardDb, taskId: string, limit = 50): TaskActivity[] {
  return db
    .select()
    .from(taskActivity)
    .where(eq(taskActivity.taskId, taskId))
    .orderBy(desc(taskActivity.timestamp), desc(taskActivity.id))
    .limit(limit)
    .all()
    .map(formatTaskActivity)
    .reverse();
}

function blockedIdSet(db: TaskyardDb, taskIds: string[]): Set<string> {
  const blocked = new Set<string>();
  if (taskIds.length === 0) return blocked;
  const deps = db
    .select()
    .from(taskDependencies)
    .where(inArray(taskDependencies.taskId, taskIds))
    .all();
  if (deps.length === 0) return blocked;
  const depIds = [...new Set(deps.map((dep) => dep.dependsOnTaskId))];
  const depRows = db.select().from(tasks).where(inArray(tasks.id, depIds)).all();
  const open = new Set(
    depRows.filter((row) => OPEN_DEPENDENCY_STATUSES.includes(row.status as TaskStatus)).map((row) => row.id),
  );
  for (const dep of deps) {
    if (open.has(dep.dependsOnTaskId)) blocked.add(dep.taskId);
  }
  return blocked;
}

function parentShortIds(db: TaskyardDb, parentIds: string[]): Map<string, string> {
  if (parentIds.length === 0) return new Map();
  const rows = db.select().from(tasks).where(inArray(tasks.id, parentIds)).all();
  return new Map(rows.map((row) => [row.id, row.shortId]));
}

function toTask(
  db: TaskyardDb,
  row: typeof tasks.$inferSelect,
  blocked: Set<string>,
  parents: Map<string, string>,
): Task {
  return formatTask(row, {
    blocked: blocked.has(row.id),
    parent_short_id: row.parentId ? (parents.get(row.parentId) ?? null) : null,
  });
}

function linkFromRow(row: typeof tasks.$inferSelect): TaskLink {
  return {
    id: row.id,
    short_id: row.shortId,
    title: row.title,
    status: row.status as TaskStatus,
  };
}

function ensureTaskPrefix(db: TaskyardDb, projectId: string): string {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new TaskError(`Project not found: ${projectId}`);
  if (project.taskPrefix) return project.taskPrefix;

  const used = new Set(
    db
      .select({ taskPrefix: projects.taskPrefix })
      .from(projects)
      .all()
      .map((row) => row.taskPrefix)
      .filter((prefix): prefix is string => Boolean(prefix)),
  );
  let prefix = taskPrefixFromName(project.name);
  if (used.has(prefix)) {
    let n = 2;
    while (used.has(`${prefix}${n}`)) n += 1;
    prefix = `${prefix}${n}`;
  }
  db.update(projects).set({ taskPrefix: prefix }).where(eq(projects.id, projectId)).run();
  return prefix;
}

function allocateShortId(db: TaskyardDb, projectId: string): string {
  const prefix = ensureTaskPrefix(db, projectId);
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new TaskError(`Project not found: ${projectId}`);
  const next = (project.nextTaskNumber ?? 0) + 1;
  db.update(projects).set({ nextTaskNumber: next }).where(eq(projects.id, projectId)).run();
  return `${prefix}-${next}`;
}

function allocateDecisionId(db: TaskyardDb, projectId: string): string {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) throw new TaskError(`Project not found: ${projectId}`);
  const next = (project.nextDecisionNumber ?? 0) + 1;
  db.update(projects)
    .set({ nextDecisionNumber: next })
    .where(eq(projects.id, projectId))
    .run();
  return `D-${String(next).padStart(3, '0')}`;
}

export function listTasks(
  db: TaskyardDb,
  filters?: { projectId?: string; status?: TaskStatus; parentId?: string | null },
) {
  const conditions = [];
  if (filters?.projectId) {
    conditions.push(eq(tasks.projectId, filters.projectId));
  }
  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters && 'parentId' in filters) {
    conditions.push(
      filters.parentId == null ? isNull(tasks.parentId) : eq(tasks.parentId, filters.parentId),
    );
  }

  const rows =
    conditions.length > 0
      ? db
          .select()
          .from(tasks)
          .where(and(...conditions))
          .orderBy(desc(tasks.updatedAt))
          .all()
      : db.select().from(tasks).orderBy(desc(tasks.updatedAt)).all();

  const blocked = blockedIdSet(
    db,
    rows.map((row) => row.id),
  );
  const parents = parentShortIds(
    db,
    rows.map((row) => row.parentId).filter((id): id is string => Boolean(id)),
  );
  return rows.map((row) => toTask(db, row, blocked, parents));
}

function decisionsForTask(db: TaskyardDb, taskId: string, taskShortId: string): TaskDecision[] {
  return db
    .select()
    .from(taskDecisions)
    .where(eq(taskDecisions.taskId, taskId))
    .orderBy(asc(taskDecisions.createdAt))
    .all()
    .map((row) => formatDecision(row, taskShortId));
}

function formatDecision(
  row: typeof taskDecisions.$inferSelect,
  taskShortId: string,
): TaskDecision {
  return {
    id: row.shortId,
    task_id: row.taskId,
    task_short_id: taskShortId,
    project_id: row.projectId,
    choice: row.choice,
    why: row.why,
    status: row.status as DecisionStatus,
    exported_at: row.exportedAt ? row.exportedAt.toISOString() : null,
    created_at: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
  };
}

function dependencyLinks(db: TaskyardDb, taskId: string): { blockedBy: TaskLink[]; blocks: TaskLink[] } {
  const blockedRows = db
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.taskId, taskId))
    .all();
  const blocksRows = db
    .select()
    .from(taskDependencies)
    .where(eq(taskDependencies.dependsOnTaskId, taskId))
    .all();
  const ids = [
    ...blockedRows.map((row) => row.dependsOnTaskId),
    ...blocksRows.map((row) => row.taskId),
  ];
  const related =
    ids.length === 0 ? [] : db.select().from(tasks).where(inArray(tasks.id, ids)).all();
  const byId = new Map(related.map((row) => [row.id, row]));
  return {
    blockedBy: blockedRows
      .map((row) => byId.get(row.dependsOnTaskId))
      .filter((row): row is typeof tasks.$inferSelect => Boolean(row))
      .map(linkFromRow),
    blocks: blocksRows
      .map((row) => byId.get(row.taskId))
      .filter((row): row is typeof tasks.$inferSelect => Boolean(row))
      .map(linkFromRow),
  };
}

export function getTaskDetail(db: TaskyardDb, id: string): TaskDetail | null {
  const row = getTaskRow(db, id);
  if (!row) return null;
  ensureBriefHistory(db, row);
  const blocked = blockedIdSet(db, [row.id]);
  const parents = parentShortIds(db, row.parentId ? [row.parentId] : []);
  const children = db
    .select()
    .from(tasks)
    .where(eq(tasks.parentId, row.id))
    .orderBy(asc(tasks.createdAt))
    .all()
    .map(formatTaskChild);
  const links = dependencyLinks(db, row.id);
  return {
    ...toTask(db, row, blocked, parents),
    activity: listRecentActivity(db, row.id),
    children,
    blocked_by: links.blockedBy,
    blocks: links.blocks,
    decisions: decisionsForTask(db, row.id, row.shortId),
  };
}

export function getTaskById(db: TaskyardDb, id: string) {
  const detail = getTaskDetail(db, id);
  return detail;
}

export function createTask(db: TaskyardDb, req: CreateTaskRequest, actor = 'user') {
  const project = getProjectById(db, req.project_id);
  if (!project) throw new TaskError(`Project not found: ${req.project_id}`);

  const title = req.title.trim();
  if (!title) throw new TaskError('title is required');

  let parentUuid: string | null = null;
  if (req.parent_id) {
    const parent = getTaskRow(db, req.parent_id);
    if (!parent) throw new TaskError(`Parent task not found: ${req.parent_id}`);
    if (parent.projectId !== req.project_id) {
      throw new TaskError('Parent task must belong to the same project');
    }
    parentUuid = parent.id;
  }

  const status = req.status ? assertTaskStatus(req.status) : 'ready';
  const description = req.description?.trim() ?? '';
  const id = randomUUID();
  const now = new Date();

  db.transaction((tx) => {
    const shortId = allocateShortId(tx, req.project_id);
    tx.insert(tasks)
      .values({
        id,
        shortId,
        projectId: req.project_id,
        parentId: parentUuid,
        title,
        description,
        status,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  });

  if (description) recordChange(db, id, actor.trim() || 'user', 'set the brief', description, now);

  return getTaskById(db, id)!;
}

export function updateTask(
  db: TaskyardDb,
  id: string,
  req: UpdateTaskRequest,
  actor = 'user',
) {
  const existing = getTaskRow(db, id);
  if (!existing) return null;

  const values: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  const who = req.actor?.trim() || actor;

  if (req.title !== undefined) {
    const title = req.title.trim();
    if (!title) throw new TaskError('title is required');
    values.title = title;
  }

  if (req.description !== undefined) {
    const description = req.description.trim();
    if (description !== (existing.description ?? '')) {
      values.description = description;
      recordChange(db, existing.id, who, 'updated the brief', description);
    }
  }

  if (req.assignee !== undefined) {
    const assignee = req.assignee?.trim() ?? '';
    values.assignee = assignee ? assignee : null;
  }

  if (req.status !== undefined) {
    const next = assertTaskStatus(req.status);
    if (next === 'waiting' && existing.status !== 'waiting') {
      const reason = req.wait_reason?.trim() ?? '';
      if (!reason) throw new TaskError('wait_reason is required when setting status to waiting');
      db.insert(taskActivity)
        .values({
          taskId: existing.id,
          kind: 'comment',
          actor: who,
          payload: JSON.stringify({ text: reason }),
        })
        .run();
    }
    if (next !== existing.status) {
      db.insert(taskActivity)
        .values({
          taskId: existing.id,
          kind: 'status',
          actor: who,
          payload: JSON.stringify({ from: existing.status, to: next }),
        })
        .run();
      values.status = next;
      // Moving to merge releases the work claim so any agent can pick up the merge. D-003
      if (next === 'merge' && req.assignee === undefined) {
        values.assignee = null;
      }
    }
  }

  if (Object.keys(values).length === 1) {
    return getTaskById(db, existing.id);
  }

  db.update(tasks).set(values).where(eq(tasks.id, existing.id)).run();
  return getTaskById(db, existing.id);
}

export function addTaskComment(db: TaskyardDb, id: string, req: AddTaskCommentRequest) {
  const existing = getTaskRow(db, id);
  if (!existing) return null;

  const text = req.text.trim();
  if (!text) throw new TaskError('text is required');

  const actor = req.actor?.trim() || 'user';
  const now = new Date();

  const inserted = db
    .insert(taskActivity)
    .values({
      taskId: existing.id,
      kind: 'comment',
      actor,
      payload: JSON.stringify({ text }),
      timestamp: now,
    })
    .returning()
    .get();

  db.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, existing.id)).run();

  return formatTaskActivity(inserted!);
}

function incompleteBlockers(db: TaskyardDb, taskId: string): TaskLink[] {
  return dependencyLinks(db, taskId).blockedBy.filter((link) =>
    OPEN_DEPENDENCY_STATUSES.includes(link.status),
  );
}

export function claimTask(db: TaskyardDb, id: string, assignee: string, actor?: string) {
  const existing = getTaskRow(db, id);
  if (!existing) return null;

  const name = assignee.trim();
  if (!name) throw new TaskError('assignee is required');

  if (existing.assignee && existing.assignee !== name) {
    throw new TaskError(`Task is already claimed by ${existing.assignee}`, 409);
  }
  if (existing.status === 'completed' || existing.status === 'cancelled') {
    throw new TaskError(`Cannot claim a ${existing.status} task`);
  }
  if (existing.status === 'in_progress' && existing.assignee === name) {
    return getTaskDetail(db, existing.id);
  }
  if (existing.status !== 'ready' && existing.status !== 'merge') {
    throw new TaskError(`Task must be ready or merge to claim (current status: ${existing.status})`);
  }

  const blockers = incompleteBlockers(db, existing.id);
  if (blockers.length > 0) {
    throw new TaskError(
      `Task is blocked by ${blockers.map((blocker) => blocker.short_id).join(', ')}`,
    );
  }

  return updateTask(db, existing.id, { status: 'in_progress', assignee: name, actor: actor ?? name }, actor ?? name);
}

export function nextTask(db: TaskyardDb, projectId: string): TaskDetail | null {
  const project = getProjectById(db, projectId);
  if (!project) throw new TaskError(`Project not found: ${projectId}`);

  const rows = db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        inArray(tasks.status, ['ready', 'merge']),
        or(isNull(tasks.assignee), eq(tasks.assignee, '')),
      ),
    )
    // Merge tasks finish accepted work and unblock dependents, so they go first.
    .orderBy(sql`CASE WHEN ${tasks.status} = 'merge' THEN 0 ELSE 1 END`, asc(tasks.createdAt))
    .all();

  for (const row of rows) {
    if (incompleteBlockers(db, row.id).length === 0) {
      return getTaskDetail(db, row.id);
    }
  }
  return null;
}

function wouldCycle(db: TaskyardDb, taskId: string, dependsOnId: string): boolean {
  const stack = [dependsOnId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    const edges = db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, current))
      .all();
    for (const edge of edges) stack.push(edge.dependsOnTaskId);
  }
  return false;
}

export function addTaskDependency(db: TaskyardDb, id: string, dependsOn: string) {
  const task = getTaskRow(db, id);
  if (!task) return null;
  const other = getTaskRow(db, dependsOn);
  if (!other) throw new TaskError(`Task not found: ${dependsOn}`);
  if (task.id === other.id) throw new TaskError('A task cannot depend on itself');
  if (task.projectId !== other.projectId) {
    throw new TaskError('Dependencies must stay in the same project');
  }
  if (wouldCycle(db, task.id, other.id)) {
    throw new TaskError('That dependency would create a cycle');
  }

  const existing = db
    .select()
    .from(taskDependencies)
    .where(
      and(eq(taskDependencies.taskId, task.id), eq(taskDependencies.dependsOnTaskId, other.id)),
    )
    .get();
  if (!existing) {
    db.insert(taskDependencies)
      .values({ taskId: task.id, dependsOnTaskId: other.id })
      .run();
  }
  return getTaskDetail(db, task.id);
}

export function removeTaskDependency(db: TaskyardDb, id: string, dependsOn: string) {
  const task = getTaskRow(db, id);
  if (!task) return null;
  const other = getTaskRow(db, dependsOn);
  if (!other) throw new TaskError(`Task not found: ${dependsOn}`);
  db.delete(taskDependencies)
    .where(
      and(eq(taskDependencies.taskId, task.id), eq(taskDependencies.dependsOnTaskId, other.id)),
    )
    .run();
  return getTaskDetail(db, task.id);
}

export function addTaskDecision(db: TaskyardDb, id: string, req: AddTaskDecisionRequest) {
  const task = getTaskRow(db, id);
  if (!task) return null;
  const choice = req.choice.trim();
  const why = req.why?.trim() ?? '';
  if (!choice) throw new TaskError('choice is required');
  const status: DecisionStatus = req.status === 'rejected' ? 'rejected' : 'accepted';
  const actor = req.actor?.trim() || 'user';

  const decisionId = randomUUID();
  const now = new Date();
  db.transaction((tx) => {
    const shortId = allocateDecisionId(tx, task.projectId);
    tx.insert(taskDecisions)
      .values({
        id: decisionId,
        shortId,
        taskId: task.id,
        projectId: task.projectId,
        choice,
        why,
        status,
        createdAt: now,
      })
      .run();
  });

  recordChange(db, task.id, actor, 'added a decision', choice);
  db.update(tasks).set({ updatedAt: now }).where(eq(tasks.id, task.id)).run();
  const row = db.select().from(taskDecisions).where(eq(taskDecisions.id, decisionId)).get()!;
  return formatDecision(row, task.shortId);
}

export function removeTaskDecision(db: TaskyardDb, id: string, decisionId: string, actor = 'user') {
  const task = getTaskRow(db, id);
  if (!task) return null;
  const key = decisionId.trim();
  const decision =
    db.select().from(taskDecisions).where(eq(taskDecisions.id, key)).get() ??
    db
      .select()
      .from(taskDecisions)
      .where(and(eq(taskDecisions.taskId, task.id), eq(taskDecisions.shortId, key)))
      .get();
  if (!decision || decision.taskId !== task.id) throw new TaskError('Decision not found');

  db.delete(taskDecisions).where(eq(taskDecisions.id, decision.id)).run();
  recordChange(db, task.id, actor.trim() || 'user', 'removed a decision', decision.choice);
  db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, task.id)).run();
  return getTaskDetail(db, task.id);
}

export function listProjectDecisions(
  db: TaskyardDb,
  projectId: string,
  opts?: { pendingOnly?: boolean },
): TaskDecision[] {
  const project = getProjectById(db, projectId);
  if (!project) throw new TaskError(`Project not found: ${projectId}`);

  const conditions = [eq(taskDecisions.projectId, projectId), eq(tasks.status, 'completed')];
  if (opts?.pendingOnly) conditions.push(isNull(taskDecisions.exportedAt));

  const rows = db
    .select({
      decision: taskDecisions,
      taskShortId: tasks.shortId,
    })
    .from(taskDecisions)
    .innerJoin(tasks, eq(taskDecisions.taskId, tasks.id))
    .where(and(...conditions))
    .orderBy(asc(taskDecisions.createdAt))
    .all();

  return rows.map((row) => formatDecision(row.decision, row.taskShortId));
}

export function listPendingDecisions(db: TaskyardDb, projectId: string): TaskDecision[] {
  return listProjectDecisions(db, projectId, { pendingOnly: true });
}

export function markDecisionsExported(db: TaskyardDb, projectId: string, ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const now = new Date();
  db.update(taskDecisions)
    .set({ exportedAt: now })
    .where(and(eq(taskDecisions.projectId, projectId), inArray(taskDecisions.shortId, unique)))
    .run();
  return listPendingDecisions(db, projectId);
}
