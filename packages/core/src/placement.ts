import { machines, threads } from '@taskyard/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { TaskyardDb } from '@taskyard/db';
import type { PlacementMode, ThreadPlacement } from '@taskyard/protocol';
import type { machines as machinesTable } from '@taskyard/db';

type MachineRow = typeof machinesTable.$inferSelect;

const ACTIVE_THREAD_STATUSES = ['pending', 'spawning', 'running', 'paused'] as const;

export class PlacementError extends Error {
  readonly code: string;
  readonly hint?: string;

  constructor(message: string, code: string, hint?: string) {
    super(message);
    this.name = 'PlacementError';
    this.code = code;
    this.hint = hint;
  }
}

export class NoMachineAvailableError extends Error {
  constructor() {
    super('No online workers available for this placement');
    this.name = 'NoMachineAvailableError';
  }
}

export function normalizePlacement(req: {
  machine_id?: string;
  placement?: ThreadPlacement;
}): ThreadPlacement {
  if (req.placement) return req.placement;
  if (req.machine_id) {
    return { mode: 'machine', machine_id: req.machine_id };
  }
  return { mode: 'auto' };
}

function parseJsonList(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return null;
  }
}

function machinePool(row: MachineRow): string {
  return row.pool?.trim() || 'default';
}

export function countActiveThreads(db: TaskyardDb, machineId: string): number {
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(threads)
    .where(
      and(eq(threads.machineId, machineId), inArray(threads.status, [...ACTIVE_THREAD_STATUSES])),
    )
    .get();
  return Number(row?.count ?? 0);
}

function isAgentAllowed(row: MachineRow, agentType: string): boolean {
  const allowed = parseJsonList(row.allowedAgentTypes);
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(agentType);
}

function isProjectAllowed(row: MachineRow, projectId: string): boolean {
  const allowed = parseJsonList(row.allowedProjectIds);
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(projectId);
}

function isUnderThreadCap(db: TaskyardDb, row: MachineRow): boolean {
  const cap = row.maxConcurrentThreads ?? 2;
  return countActiveThreads(db, row.id) < cap;
}

function machineScore(row: MachineRow): number {
  const ramHeadroom = (row.ramGb ?? 0) - (row.ramUsedGb ?? 0);
  const cpuHeadroom = 100 - (row.cpuPercent ?? 100);
  return (row.priority ?? 0) * 1000 + ramHeadroom * 10 + cpuHeadroom;
}

function filterEligible(
  db: TaskyardDb,
  rows: MachineRow[],
  projectId: string,
  agentType: string,
): MachineRow[] {
  return rows.filter(
    (m) =>
      m.status === 'online' &&
      m.schedulingMode !== 'disabled' &&
      isAgentAllowed(m, agentType) &&
      isProjectAllowed(m, projectId) &&
      isUnderThreadCap(db, m),
  );
}

function pickBest(db: TaskyardDb, candidates: MachineRow[]): string {
  if (candidates.length === 0) throw new NoMachineAvailableError();

  let best = candidates[0]!;
  let bestScore = machineScore(best);
  for (const m of candidates.slice(1)) {
    const score = machineScore(m);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return best.id;
}

export function resolvePlacement(
  db: TaskyardDb,
  opts: {
    projectId: string;
    agentType: string;
    placement: ThreadPlacement;
  },
): string {
  const { projectId, agentType, placement } = opts;
  const online = db.select().from(machines).where(eq(machines.status, 'online')).all();

  if (online.length === 0) {
    throw new NoMachineAvailableError();
  }

  const mode: PlacementMode = placement.mode;

  if (mode === 'machine') {
    const id = placement.machine_id;
    if (!id) {
      throw new PlacementError('machine_id is required for machine placement', 'MACHINE_REQUIRED');
    }
    const m = db.select().from(machines).where(eq(machines.id, id)).get();
    if (!m) throw new PlacementError(`Machine not found: ${id}`, 'MACHINE_NOT_FOUND');
    if (m.status !== 'online') {
      throw new PlacementError(`Machine ${m.name} is not online`, 'MACHINE_OFFLINE');
    }
    if (m.schedulingMode === 'disabled') {
      throw new PlacementError(`Machine ${m.name} is disabled for scheduling`, 'MACHINE_DISABLED');
    }
    const [eligible] = filterEligible(db, [m], projectId, agentType);
    if (!eligible) {
      throw new PlacementError(
        `Machine ${m.name} cannot run this thread (agent, project, or thread cap)`,
        'MACHINE_NOT_ELIGIBLE',
      );
    }
    return id;
  }

  if (mode === 'local') {
    const locals = online.filter((m) => m.isLocal);
    const eligible = filterEligible(db, locals, projectId, agentType);
    if (eligible.length === 0) {
      const anyLocal = locals.length > 0;
      throw new PlacementError(
        anyLocal
          ? 'Local worker is online but cannot run this thread (busy, agent, or project rules)'
          : 'No local worker online',
        anyLocal ? 'LOCAL_NOT_ELIGIBLE' : 'NO_LOCAL_WORKER',
        'Start a worker on this computer: pnpm dev:worker -- --hub <url> --local',
      );
    }
    return pickBest(db, eligible);
  }

  if (mode === 'pool') {
    const pool = placement.pool?.trim() || 'default';
    const inPool = online.filter((m) => machinePool(m) === pool && m.schedulingMode !== 'manual_only');
    const eligible = filterEligible(db, inPool, projectId, agentType);
    if (eligible.length === 0) {
      throw new PlacementError(
        `No eligible workers in pool "${pool}"`,
        'POOL_EMPTY',
        'Check Machines settings or pick another pool',
      );
    }
    return pickBest(db, eligible);
  }

  // auto: exclude manual_only and disabled
  const autoCandidates = online.filter((m) => m.schedulingMode === 'auto');
  const eligible = filterEligible(db, autoCandidates, projectId, agentType);
  if (eligible.length === 0) {
    throw new NoMachineAvailableError();
  }
  return pickBest(db, eligible);
}
