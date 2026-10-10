import type {
  Task,
  TaskActivity,
  TaskDecision,
  TaskDetail,
  TaskStatus,
  ThreadDetail,
} from '@taskyard/protocol';
import { announceUpdatedInstructions, writeAgentsInstructions } from './agents-file.js';
import { syncDecisionsFile } from './decisions-file.js';
import { decisionsFilePath, readProjectFile, resolveProjectContext, writeProjectFile } from './project-file.js';

export type { Task, TaskActivity, TaskDetail, TaskStatus };

export const TASK_STATUSES: TaskStatus[] = [
  'backlog',
  'ready',
  'in_progress',
  'review',
  'merge',
  'waiting',
  'completed',
  'cancelled',
];

export type ListTasksResponse = { tasks: Task[] };
export type GetTaskResponse = { task: TaskDetail };
export type CreateTaskResponse = { task: Task };
export type UpdateTaskResponse = { task: Task };
export type AddCommentResponse = { activity: TaskActivity };
export type GetThreadResponse = { thread: ThreadDetail };

export type ShowThreadResult = {
  thread_id: string;
  project_id: string;
  project_name: string | null;
  task_id: string | null;
  task: Task | null;
  status: string;
  workspace: string | null;
};

export type ApiErrorBody = {
  error: string;
  code?: string;
  hint?: string;
};

export class TaskCliError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error);
    this.name = 'TaskCliError';
    this.status = status;
    this.body = body;
  }
}

export function getServerUrl(): string {
  return resolveProjectContext().serverUrl;
}

function requireProjectId(explicit?: string): string {
  const projectId = resolveProjectContext(explicit).projectId;
  if (!projectId) {
    throw new TaskCliError(1, {
      error: 'project_id is required',
      hint: 'Run from a project that contains .taskyard/project.json, pass --project <id>, or set TASKYARD_PROJECT_ID.',
    });
  }
  return projectId;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJsonBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text || res.statusText || 'Request failed' };
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, serverUrl?: string): Promise<T> {
  const url = joinUrl(serverUrl ?? getServerUrl(), path);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new TaskCliError(0, { error: `Failed to reach Taskyard server at ${url}: ${message}` });
  }

  const body = await parseJsonBody(res);
  if (!res.ok) {
    let errorBody: ApiErrorBody;
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const raw = String((body as ApiErrorBody).error);
      const looksLikeHtml = raw.startsWith('<!DOCTYPE') || raw.startsWith('<html');
      errorBody = looksLikeHtml
        ? { error: `HTTP ${res.status}: ${res.statusText || 'Request failed'} (${path})` }
        : (body as ApiErrorBody);
    } else {
      errorBody = { error: `HTTP ${res.status}: ${res.statusText || 'Request failed'}`.trim() };
    }
    throw new TaskCliError(res.status, errorBody);
  }

  return body as T;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new TaskCliError(1, {
      error: `Missing required environment variable: ${name}`,
      hint: `Set ${name} or pass an explicit id argument.`,
    });
  }
  return value;
}

export function assertTaskStatus(status: string): TaskStatus {
  if (!TASK_STATUSES.includes(status as TaskStatus)) {
    throw new TaskCliError(1, {
      error: `Invalid status: ${status}`,
      hint: `Expected one of: ${TASK_STATUSES.join(', ')}`,
    });
  }
  return status as TaskStatus;
}

export function writeOutput(data: unknown, pretty: boolean): void {
  if (pretty) {
    process.stdout.write(formatPretty(data) + '\n');
    return;
  }
  process.stdout.write(`${JSON.stringify(data)}\n`);
}

export function writeError(err: unknown): void {
  const payload =
    err instanceof TaskCliError
      ? { error: err.body.error, status: err.status, code: err.body.code, hint: err.body.hint }
      : { error: err instanceof Error ? err.message : String(err) };
  process.stderr.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = 1;
}

function formatPretty(data: unknown): string {
  if (!data || typeof data !== 'object') return String(data);

  if ('tasks' in data && Array.isArray((data as ListTasksResponse).tasks)) {
    const { tasks } = data as ListTasksResponse;
    if (tasks.length === 0) return 'No tasks.';
    return tasks
      .map((t) => `${t.short_id}\t${t.status.padEnd(12)}\t${t.blocked ? 'blocked\t' : ''}${t.title}`)
      .join('\n');
  }

  if ('task' in data) {
    const task = (data as { task: TaskDetail | null }).task;
    if (!task) return 'No claimable task.';
    const lines = [
      `${task.short_id} — ${task.title}`,
      `id: ${task.id}`,
      `status: ${task.status}${task.blocked ? ' (blocked)' : ''}`,
      `project: ${task.project_id}`,
    ];
    if (task.parent_short_id) lines.push(`parent: ${task.parent_short_id}`);
    if (task.assignee) lines.push(`assignee: ${task.assignee}`);
    if (task.description) {
      lines.push('', task.description);
    }
    if ('activity' in task && Array.isArray(task.activity) && task.activity.length > 0) {
      lines.push('', 'Activity:');
      for (const item of task.activity) {
        if (item.type === 'comment') {
          lines.push(`  [${item.created_at}] ${item.actor}: ${item.text}`);
        } else if (item.type === 'status_change') {
          lines.push(`  [${item.created_at}] ${item.actor}: ${item.from} → ${item.to}`);
        } else {
          lines.push(`  [${item.created_at}] ${item.actor}: ${item.summary}`);
        }
      }
    }
    if ('children' in task && Array.isArray(task.children) && task.children.length > 0) {
      lines.push('', 'Children:');
      for (const child of task.children) {
        lines.push(`  ${child.short_id}\t${child.status}\t${child.title}`);
      }
    }
    if ('blocked_by' in task && Array.isArray(task.blocked_by) && task.blocked_by.length > 0) {
      lines.push('', 'Blocked by:');
      for (const dep of task.blocked_by) {
        lines.push(`  ${dep.short_id}\t${dep.status}\t${dep.title}`);
      }
    }
    if ('decisions' in task && Array.isArray(task.decisions) && task.decisions.length > 0) {
      lines.push('', 'Decisions:');
      for (const decision of task.decisions) {
        lines.push(`  ${decision.id} [${decision.status}] ${decision.choice}`);
      }
    }
    return lines.join('\n');
  }

  if ('thread_id' in data) {
    const t = data as ShowThreadResult;
    const lines = [
      `Thread: ${t.thread_id}`,
      `Project: ${t.project_name ?? t.project_id}`,
      `Status: ${t.status}`,
    ];
    if (t.workspace) lines.push(`Workspace: ${t.workspace}`);
    if (t.task_id) {
      lines.push(`Primary task: ${t.task_id}`);
      if (t.task) {
        lines.push(`  ${t.task.short_id} ${t.task.title} (${t.task.status})`);
      }
    } else {
      lines.push('Primary task: (none)');
    }
    return lines.join('\n');
  }

  if ('activity' in data) {
    const { activity } = data as AddCommentResponse;
    if (activity.type === 'comment') {
      return `[${activity.created_at}] ${activity.actor}: ${activity.text}`;
    }
    if (activity.type === 'status_change') {
      return `[${activity.created_at}] ${activity.actor}: ${activity.from} → ${activity.to}`;
    }
    return `[${activity.created_at}] ${activity.actor}: ${activity.summary}`;
  }

  return JSON.stringify(data, null, 2);
}

export async function cmdGet(id: string | undefined, pretty: boolean): Promise<void> {
  const taskId = id ?? requireEnv('TASKYARD_TASK_ID');
  const data = await apiFetch<GetTaskResponse>(`/api/tasks/${encodeURIComponent(taskId)}`);
  writeOutput(data, pretty);
}

export async function cmdList(
  opts: { project?: string; status?: string; parent?: string },
  pretty: boolean,
): Promise<void> {
  const params = new URLSearchParams();
  const project = requireProjectId(opts.project);
  if (project) params.set('project_id', project);
  if (opts.status) params.set('status', assertTaskStatus(opts.status));
  if (opts.parent) params.set('parent_id', opts.parent);

  const qs = params.toString();
  const data = await apiFetch<ListTasksResponse>(`/api/tasks${qs ? `?${qs}` : ''}`);
  writeOutput(data, pretty);
}

export async function cmdCreate(
  opts: {
    title: string;
    parent?: string;
    project?: string;
    description?: string;
  },
  pretty: boolean,
): Promise<void> {
  const projectId = requireProjectId(opts.project);

  const body: Record<string, string | null> = {
    title: opts.title,
    project_id: projectId,
  };
  if (opts.parent) body.parent_id = opts.parent;
  if (opts.description) body.description = opts.description;

  const data = await apiFetch<CreateTaskResponse>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  writeOutput(data, pretty);
}

export function actorFromEnv(): string {
  return process.env.TASKYARD_ACTOR?.trim() || 'agent';
}

export function claimerFromEnv(explicit?: string): string {
  const value = explicit?.trim() || process.env.TASKYARD_ACTOR?.trim() || process.env.TASKYARD_THREAD_ID?.trim();
  if (!value) {
    throw new TaskCliError(1, {
      error: 'assignee is required',
      hint: 'Pass --as <name> or set TASKYARD_ACTOR.',
    });
  }
  return value;
}

export async function cmdStatus(
  id: string,
  status: string,
  pretty: boolean,
  reason?: string,
): Promise<void> {
  const next = assertTaskStatus(status);
  if (next === 'waiting' && !reason?.trim()) {
    throw new TaskCliError(1, {
      error: 'waiting requires a reason',
      hint: 'Pass --reason "..." explaining who or what you are waiting on.',
    });
  }
  const body: Record<string, string> = { status: next, actor: actorFromEnv() };
  if (reason?.trim()) body.wait_reason = reason.trim();
  const data = await apiFetch<UpdateTaskResponse>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  writeOutput(data, pretty);
}

export async function cmdUpdate(
  id: string,
  opts: { title?: string; description?: string; assignee?: string },
  pretty: boolean,
): Promise<void> {
  const body: Record<string, string | null> = { actor: actorFromEnv() };
  if (opts.title !== undefined) body.title = opts.title;
  if (opts.description !== undefined) body.description = opts.description;
  if (opts.assignee !== undefined) body.assignee = opts.assignee;
  if (Object.keys(body).length === 1) {
    throw new TaskCliError(1, {
      error: 'Nothing to update',
      hint: 'Pass --title, --description, or --assignee.',
    });
  }
  const data = await apiFetch<UpdateTaskResponse>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  writeOutput(data, pretty);
}

export async function cmdClaim(id: string, asName: string | undefined, pretty: boolean): Promise<void> {
  const data = await apiFetch<GetTaskResponse>(`/api/tasks/${encodeURIComponent(id)}/claim`, {
    method: 'POST',
    body: JSON.stringify({ assignee: claimerFromEnv(asName), actor: actorFromEnv() }),
  });
  writeOutput(data, pretty);
}

export async function cmdNext(project: string | undefined, pretty: boolean): Promise<void> {
  const projectId = requireProjectId(project);
  const data = await apiFetch<{ task: TaskDetail | null }>(
    `/api/tasks/next?project_id=${encodeURIComponent(projectId)}`,
  );
  writeOutput(data, pretty);
}

export async function cmdDepend(id: string, dependsOn: string, pretty: boolean): Promise<void> {
  const data = await apiFetch<GetTaskResponse>(
    `/api/tasks/${encodeURIComponent(id)}/dependencies`,
    {
      method: 'POST',
      body: JSON.stringify({ depends_on: dependsOn }),
    },
  );
  writeOutput(data, pretty);
}

export async function cmdDecisionAdd(
  opts: { task: string; choice: string; why?: string; rejected?: boolean },
  pretty: boolean,
): Promise<void> {
  const data = await apiFetch<{ decision: TaskDecision }>(
    `/api/tasks/${encodeURIComponent(opts.task)}/decisions`,
    {
      method: 'POST',
      body: JSON.stringify({
        choice: opts.choice,
        ...(opts.why?.trim() ? { why: opts.why.trim() } : {}),
        status: opts.rejected ? 'rejected' : 'accepted',
        actor: actorFromEnv(),
      }),
    },
  );
  writeOutput(data, pretty);
}

async function syncDecisionFile(opts: {
  workspace: string;
  projectId: string;
  serverUrl: string;
}): Promise<string[]> {
  const data = await apiFetch<{ decisions: TaskDecision[] }>(
    `/api/decisions?project_id=${encodeURIComponent(opts.projectId)}`,
    undefined,
    opts.serverUrl,
  );
  if (data.decisions.length === 0) return [];

  const recorded = syncDecisionsFile(opts.workspace, data.decisions);
  if (recorded.length === 0) return [];
  await apiFetch(
    '/api/decisions/exported',
    {
      method: 'POST',
      body: JSON.stringify({ project_id: opts.projectId, ids: recorded }),
    },
    opts.serverUrl,
  );
  return recorded;
}

export async function flushPendingDecisions(): Promise<string[]> {
  const { projectId, serverUrl, workspace } = resolveProjectContext();
  if (!workspace || !projectId) return [];
  return syncDecisionFile({ workspace, projectId, serverUrl });
}

export async function cmdExportDecisions(pretty: boolean): Promise<void> {
  const { projectId, workspace } = resolveProjectContext();
  if (!workspace || !projectId) {
    throw new TaskCliError(1, {
      error: 'No project workspace found',
      hint: 'Run inside a project with .taskyard/project.json, or set TASKYARD_WORKSPACE and TASKYARD_PROJECT_ID.',
    });
  }
  const ids = await flushPendingDecisions();
  writeOutput({ exported: ids }, pretty);
}

export async function cmdLink(
  opts: { project: string; dir?: string; server?: string },
  pretty: boolean,
): Promise<void> {
  const dir = opts.dir ?? process.cwd();
  const target = writeProjectFile(
    dir,
    { project_id: opts.project, server_url: opts.server },
    { overwrite: true },
  );
  writeOutput({ project_file: target, project_id: opts.project }, pretty);
}

export async function cmdSetup(
  opts: { project?: string; dir?: string; server?: string },
  pretty: boolean,
): Promise<void> {
  const dir = opts.dir ?? process.cwd();
  const existing = readProjectFile(dir);
  const projectId = opts.project?.trim() || existing?.project_id || process.env.TASKYARD_PROJECT_ID?.trim();
  if (!projectId) {
    throw new TaskCliError(1, {
      error: 'project_id is required',
      hint: 'Pass --project <id> from the Taskyard project, or run setup in a checkout that already has .taskyard/project.json.',
    });
  }
  const serverUrl =
    opts.server?.trim() || existing?.server_url || process.env.TASKYARD_SERVER_URL?.trim() || 'http://127.0.0.1:3000';
  const projectFile = writeProjectFile(
    dir,
    { project_id: projectId, server_url: serverUrl },
    { overwrite: Boolean(opts.project || opts.server) },
  );
  const synced = await syncDecisionFile({ workspace: dir, projectId, serverUrl });
  const agentsFile = writeAgentsInstructions(dir);
  if (agentsFile.updated) announceUpdatedInstructions(agentsFile.file);
  writeOutput(
    {
      project_file: projectFile,
      decisions_file: decisionsFilePath(dir),
      agents_file: agentsFile.file,
      project_id: projectId,
      synced,
    },
    pretty,
  );
}

export async function cmdSync(opts: { dir?: string; server?: string }, pretty: boolean): Promise<void> {
  const start = opts.dir ?? process.cwd();
  const direct = readProjectFile(start);
  const context = direct
    ? { workspace: start, file: direct }
    : (() => {
        const resolved = resolveProjectContext();
        if (!resolved.workspace || !resolved.projectId) return null;
        const file = readProjectFile(resolved.workspace);
        return file ? { workspace: resolved.workspace, file } : null;
      })();
  if (!context) {
    throw new TaskCliError(1, {
      error: 'No .taskyard/project.json found',
      hint: 'Run taskyard setup --project <id> in the project checkout.',
    });
  }
  const serverUrl = opts.server?.trim() || context.file.server_url || 'http://127.0.0.1:3000';
  const synced = await syncDecisionFile({
    workspace: context.workspace,
    projectId: context.file.project_id,
    serverUrl,
  });
  writeOutput({ decisions_file: decisionsFilePath(context.workspace), synced }, pretty);
}

export async function cmdComment(id: string, text: string, pretty: boolean): Promise<void> {
  const data = await apiFetch<AddCommentResponse>(
    `/api/tasks/${encodeURIComponent(id)}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ text, actor: 'agent' }),
    },
  );
  writeOutput(data, pretty);
}

export async function cmdShowThread(pretty: boolean): Promise<void> {
  const threadId = requireEnv('TASKYARD_THREAD_ID');
  const { thread } = await apiFetch<GetThreadResponse>(
    `/api/threads/${encodeURIComponent(threadId)}`,
  );

  const taskId = thread.task_id ?? null;
  let task: Task | null = null;
  if (taskId) {
    try {
      const taskRes = await apiFetch<GetTaskResponse>(
        `/api/tasks/${encodeURIComponent(taskId)}`,
      );
      task = taskRes.task;
    } catch {
      task = null;
    }
  }

  const result: ShowThreadResult = {
    thread_id: thread.id,
    project_id: thread.project_id,
    project_name: thread.project_name ?? null,
    task_id: taskId,
    task,
    status: thread.status,
    workspace: thread.worktree_path,
  };
  writeOutput(result, pretty);
}

export async function runTaskCommand(
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
    await flushPendingDecisions();
  } catch (err) {
    writeError(err);
    process.exitCode = 1;
  }
}
