import { ideas, machines, projects, threads } from '@taskyard/db';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { TaskyardDb } from '@taskyard/db';
import type { CreateThreadRequest, ThreadState } from '@taskyard/protocol';
import { formatThread } from './format.js';
import { normalizePlacement, resolvePlacement } from './placement.js';
import { releasePorts } from './port-registry.js';
import { getEnvForAgent } from './vault.js';
import { getProjectById, ProjectError } from './projects.js';
import {
  hubSpawn,
  hubKill,
  hubClose,
  hubFollowUp,
  hubResolvePrompt,
  HubUnreachableError,
} from './hub-client.js';
import { listThreadEvents } from './events.js';
import { isOfferedAgent, readAgentManifest } from './agents.js';
import { composeThreadPrompt, getTaskById, TaskError } from './tasks.js';
import { canReadIdeaId, getOwnedIdeaDetail, IdeaError } from './ideas.js';
import { IDEA_CLI_CONTRACT } from './idea-cli-contract.js';

const TERMINAL_STATUSES: ThreadState[] = ['completed', 'error', 'closed'];
const KILLABLE_STATUSES: ThreadState[] = ['pending', 'spawning', 'running', 'paused'];

function threadNames(db: TaskyardDb, row: typeof threads.$inferSelect) {
  const project = row.projectId
    ? db.select().from(projects).where(eq(projects.id, row.projectId)).get()
    : undefined;
  const idea = row.ideaId
    ? db.select().from(ideas).where(eq(ideas.id, row.ideaId)).get()
    : undefined;
  const machine = row.machineId
    ? db.select().from(machines).where(eq(machines.id, row.machineId)).get()
    : undefined;
  return {
    project_name: project?.name ?? idea?.title,
    idea_short_id: idea?.shortId,
    machine_name: machine?.name,
  };
}

export function canReadThread(db: TaskyardDb, threadId: string, personId?: string): boolean {
  const row = db.select({ ideaId: threads.ideaId }).from(threads).where(eq(threads.id, threadId)).get();
  if (!row) return false;
  return !row.ideaId || Boolean(personId && canReadIdeaId(db, row.ideaId, personId));
}

export function listThreads(db: TaskyardDb, status?: ThreadState, personId?: string) {
  const rows = status
    ? db.select().from(threads).where(eq(threads.status, status)).orderBy(desc(threads.createdAt)).all()
    : db.select().from(threads).orderBy(desc(threads.createdAt)).all();

  return rows
    .filter((row) => !row.ideaId || Boolean(personId && canReadIdeaId(db, row.ideaId, personId)))
    .map((row) => formatThread(row, threadNames(db, row)));
}

export function getThreadDetail(db: TaskyardDb, id: string) {
  const row = db.select().from(threads).where(eq(threads.id, id)).get();
  if (!row) return null;

  return {
    ...formatThread(row, threadNames(db, row)),
    events: listThreadEvents(db, id, { limit: 50 }),
  };
}

// D-010
async function createIdeaThread(db: TaskyardDb, req: CreateThreadRequest, personId?: string) {
  if (!personId) throw new IdeaError('Sign in required to discuss an idea.', 401);
  const idea = getOwnedIdeaDetail(db, req.idea_id!, personId);
  if (idea.status !== 'active') throw new IdeaError('Only an active idea can start a discussion.', 409);
  const seed = `# ${idea.short_id}: ${idea.title}${idea.description.trim() ? `\n\n${idea.description.trim()}` : ''}`;
  const base = req.prompt?.trim() ? `${seed}\n\n${req.prompt.trim()}` : seed;
  const prompt = `${base}\n\n${IDEA_CLI_CONTRACT}`;
  const machineId = resolvePlacement(db, {
    projectId: null,
    agentType: req.agent_type,
    placement: normalizePlacement(req),
  });
  const threadId = randomUUID();
  db.insert(threads)
    .values({
      id: threadId,
      projectId: null,
      ideaId: idea.id,
      machineId,
      agentType: req.agent_type,
      branch: '',
      prompt,
      status: 'pending',
    })
    .run();

  try {
    await hubSpawn(
      {
        type: 'spawn_thread',
        thread_id: threadId,
        project_id: null,
        idea_id: idea.id,
        project: idea.title,
        repo_url: null,
        branch: null,
        agent_type: req.agent_type,
        prompt,
        env: { ...getEnvForAgent(db, req.agent_type), TASKYARD_PERSON_ID: personId },
      },
      machineId,
    );
    db.update(threads).set({ status: 'spawning' }).where(eq(threads.id, threadId)).run();
  } catch (err) {
    db.update(threads)
      .set({ status: 'error', completedAt: new Date() })
      .where(eq(threads.id, threadId))
      .run();
    if (err instanceof HubUnreachableError) {
      throw new Error('No worker connected — start a worker and try again');
    }
    throw err;
  }

  const row = db.select().from(threads).where(eq(threads.id, threadId)).get()!;
  return formatThread(row, { project_name: idea.title, idea_short_id: idea.short_id });
}

export async function createThread(db: TaskyardDb, req: CreateThreadRequest, personId?: string) {
  const manifest = readAgentManifest(req.agent_type);
  if (!manifest || !isOfferedAgent(req.agent_type, manifest)) {
    throw new Error(`Unknown agent type: ${req.agent_type}`);
  }
  if (req.idea_id) {
    if (req.project_id || req.task_id) throw new IdeaError('An idea thread cannot include a project or task.');
    return createIdeaThread(db, req, personId);
  }
  if (!req.project_id) throw new Error('project_id or idea_id is required');
  const project = getProjectById(db, req.project_id);
  if (!project) throw new Error(`Project not found: ${req.project_id}`);
  if (project.archived) throw new ProjectError('Project is archived');
  if (!project.repoUrl) throw new ProjectError('Project has no repository configured');

  let taskId: string | null = req.task_id ?? null;
  let linkedTask: ReturnType<typeof getTaskById> = null;
  if (taskId) {
    linkedTask = getTaskById(db, taskId);
    if (!linkedTask) throw new TaskError(`Task not found: ${taskId}`);
    if (linkedTask.project_id !== project.id) {
      throw new TaskError('Task must belong to the same project');
    }
    taskId = linkedTask.id;
  }

  const prompt = composeThreadPrompt(req.prompt, linkedTask);
  if (!prompt) throw new Error('prompt or task_id is required');

  const placement = normalizePlacement(req);
  const machineId = resolvePlacement(db, {
    projectId: project.id,
    agentType: req.agent_type,
    placement,
  });
  const threadId = randomUUID();
  const env = getEnvForAgent(db, req.agent_type);

  db.insert(threads)
    .values({
      id: threadId,
      projectId: project.id,
      taskId,
      machineId,
      agentType: req.agent_type,
      branch: req.branch || project.defaultBranch || 'main',
      prompt,
      status: 'pending',
    })
    .run();

  try {
    await hubSpawn(
      {
        type: 'spawn_thread',
        thread_id: threadId,
        project_id: project.id,
        project: project.name,
        repo_url: project.repoUrl,
        branch: req.branch || project.defaultBranch || 'main',
        agent_type: req.agent_type,
        prompt,
        ...(taskId ? { task_id: taskId } : {}),
        env,
      },
      machineId,
    );
    db.update(threads).set({ status: 'spawning' }).where(eq(threads.id, threadId)).run();
  } catch (err) {
    releasePorts(db, threadId);
    db.update(threads)
      .set({ status: 'error', completedAt: new Date() })
      .where(eq(threads.id, threadId))
      .run();
    if (err instanceof HubUnreachableError) {
      throw new Error('No worker connected — start a worker and try again');
    }
    throw err;
  }

  const row = db.select().from(threads).where(eq(threads.id, threadId)).get()!;
  return formatThread(row, { project_name: project.name });
}

export async function killThread(db: TaskyardDb, id: string) {
  const row = db.select().from(threads).where(eq(threads.id, id)).get();
  if (!row) return null;
  if (!KILLABLE_STATUSES.includes(row.status as ThreadState)) {
    throw new Error(`Thread cannot be killed in status: ${row.status}`);
  }
  if (!row.machineId) throw new Error('Thread has no assigned machine');

  try {
    await hubKill(id, row.machineId);
  } catch {
    // Worker may already be gone; still mark error locally.
  }

  db.update(threads)
    .set({ status: 'error', completedAt: new Date() })
    .where(eq(threads.id, id))
    .run();
  releasePorts(db, id);

  return getThreadDetail(db, id);
}

export async function followUpThread(db: TaskyardDb, id: string, prompt: string) {
  const row = db.select().from(threads).where(eq(threads.id, id)).get();
  if (!row) return null;
  if (!KILLABLE_STATUSES.includes(row.status as ThreadState)) {
    throw new Error(`Thread cannot accept follow-up in status: ${row.status}`);
  }
  if (!row.machineId) throw new Error('Thread has no assigned machine');
  const text = prompt.trim();
  if (!text) throw new Error('prompt is required');

  try {
    await hubFollowUp(id, row.machineId, text);
  } catch (err) {
    if (err instanceof HubUnreachableError) {
      throw new Error('No worker connected — start a worker and try again');
    }
    throw err;
  }
  return { ok: true as const };
}

/** Forward a UI resolve payload to the worker ACP session as JSON-RPC result. */
export async function resolveThreadPrompt(
  db: TaskyardDb,
  id: string,
  requestId: string,
  result: unknown,
) {
  const row = db.select().from(threads).where(eq(threads.id, id)).get();
  if (!row) return null;
  if (!row.machineId) throw new Error('Thread has no assigned machine');
  if (!requestId) throw new Error('request_id is required');

  try {
    await hubResolvePrompt(id, row.machineId, requestId, result);
  } catch (err) {
    if (err instanceof HubUnreachableError) {
      throw new Error('No worker connected — start a worker and try again');
    }
    throw err;
  }
  return { ok: true as const };
}

export async function closeThread(db: TaskyardDb, id: string) {
  const row = db.select().from(threads).where(eq(threads.id, id)).get();
  if (!row) return null;
  if (!['completed', 'error'].includes(row.status ?? '')) {
    throw new Error(`Thread can only be closed from completed or error status`);
  }
  if (!row.machineId) throw new Error('Thread has no assigned machine');

  try {
    await hubClose(id, row.machineId);
  } catch {
    // Best-effort close on worker.
  }

  db.update(threads)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(threads.id, id))
    .run();
  releasePorts(db, id);

  return getThreadDetail(db, id);
}

export function updateThreadState(
  db: TaskyardDb,
  threadId: string,
  state: ThreadState,
  extra?: { containerId?: string; worktreePath?: string },
): void {
  const updates: Partial<typeof threads.$inferInsert> = { status: state };
  const now = new Date();

  if (state === 'running') updates.startedAt = now;
  if (state === 'completed' || state === 'error') updates.completedAt = now;
  if (state === 'closed') updates.closedAt = now;
  if (extra?.containerId) updates.containerId = extra.containerId;
  if (extra?.worktreePath) updates.worktreePath = extra.worktreePath;

  db.update(threads).set(updates).where(eq(threads.id, threadId)).run();

  if (TERMINAL_STATUSES.includes(state) && state !== 'closed') {
    // Keep ports until explicit close for completed/error.
  }
}
