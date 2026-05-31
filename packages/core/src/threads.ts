import { machines, projects, threads } from '@taskyard/db';
import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { TaskyardDb } from '@taskyard/db';
import type { CreateThreadRequest, ThreadState } from '@taskyard/protocol';
import { formatThread } from './format.js';
import { pickMachine, NoMachineAvailableError } from './machine-picker.js';
import { allocatePorts, releasePorts, PortExhaustedError } from './port-registry.js';
import { getEnvForAgent } from './vault.js';
import { getProjectById } from './projects.js';
import { hubSpawn, hubKill, hubClose, HubUnreachableError } from './hub-client.js';
import { listThreadEvents } from './events.js';
import { readAgentManifest } from './agents.js';

const TERMINAL_STATUSES: ThreadState[] = ['completed', 'error', 'closed'];
const KILLABLE_STATUSES: ThreadState[] = ['pending', 'spawning', 'running', 'paused'];

export function listThreads(db: TaskyardDb, status?: ThreadState) {
  const rows = status
    ? db.select().from(threads).where(eq(threads.status, status)).orderBy(desc(threads.createdAt)).all()
    : db.select().from(threads).orderBy(desc(threads.createdAt)).all();

  return rows.map((row) => {
    const project = row.projectId
      ? db.select().from(projects).where(eq(projects.id, row.projectId)).get()
      : undefined;
    const machine = row.machineId
      ? db.select().from(machines).where(eq(machines.id, row.machineId)).get()
      : undefined;
    return formatThread(row, {
      project_name: project?.name,
      machine_name: machine?.name,
    });
  });
}

export function getThreadDetail(db: TaskyardDb, id: string) {
  const row = db.select().from(threads).where(eq(threads.id, id)).get();
  if (!row) return null;

  const project = row.projectId
    ? db.select().from(projects).where(eq(projects.id, row.projectId)).get()
    : undefined;
  const machine = row.machineId
    ? db.select().from(machines).where(eq(machines.id, row.machineId)).get()
    : undefined;

  return {
    ...formatThread(row, {
      project_name: project?.name,
      machine_name: machine?.name,
    }),
    events: listThreadEvents(db, id, { limit: 50 }),
  };
}

export async function createThread(db: TaskyardDb, req: CreateThreadRequest) {
  const project = getProjectById(db, req.project_id);
  if (!project) throw new Error(`Project not found: ${req.project_id}`);

  const manifest = readAgentManifest(req.agent_type);
  if (!manifest) throw new Error(`Unknown agent type: ${req.agent_type}`);

  const machineId = pickMachine(db, req.machine_id);
  const threadId = randomUUID();
  const { web, rustdesk } = allocatePorts(db, machineId, threadId);
  const env = getEnvForAgent(db, req.agent_type);

  db.insert(threads)
    .values({
      id: threadId,
      projectId: project.id,
      machineId,
      agentType: req.agent_type,
      branch: req.branch || project.defaultBranch || 'main',
      prompt: req.prompt,
      status: 'pending',
      webPort: web,
      rustdeskPort: rustdesk,
    })
    .run();

  try {
    await hubSpawn(
      {
        type: 'spawn_thread',
        thread_id: threadId,
        project: project.name,
        repo_url: project.repoUrl,
        branch: req.branch || project.defaultBranch || 'main',
        agent_type: req.agent_type,
        prompt: req.prompt,
        ports: { web, rustdesk },
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

export { NoMachineAvailableError, PortExhaustedError };
