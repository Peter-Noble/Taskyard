import { machines, threads } from '@taskyard/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { TaskyardDb } from '@taskyard/db';
import type { Machine, WorkerMessage } from '@taskyard/protocol';
import { formatMachine } from './format.js';

export type MachineWithUtilization = Machine & {
  port_utilization: { used: number; total: number };
};
import { countPortUtilization } from './port-registry.js';

const ACTIVE_THREAD_STATUSES = ['pending', 'spawning', 'running', 'paused'] as const;

export function getMachineById(db: TaskyardDb, id: string) {
  return db.select().from(machines).where(eq(machines.id, id)).get();
}

export function upsertMachineOnRegister(
  db: TaskyardDb,
  msg: Extract<WorkerMessage, { type: 'register' }>,
  ipAddress?: string | null,
): void {
  const existing = getMachineById(db, msg.id);
  const values = {
    id: msg.id,
    name: msg.hostname,
    ipAddress: ipAddress ?? existing?.ipAddress ?? null,
    portRangeStart: msg.port_range.start,
    portRangeEnd: msg.port_range.end,
    cpuCores: msg.specs.cpu_cores,
    ramGb: msg.specs.ram_gb,
    gpuInfo: msg.specs.gpu,
    status: 'online' as const,
    lastHeartbeat: new Date(),
  };

  if (existing) {
    db.update(machines).set(values).where(eq(machines.id, msg.id)).run();
  } else {
    db.insert(machines).values(values).run();
  }
}

export function updateMachineHeartbeat(
  db: TaskyardDb,
  machineId: string,
  cpuPercent: number,
  ramUsedGb: number,
): void {
  db.update(machines)
    .set({
      status: 'online',
      cpuPercent,
      ramUsedGb,
      lastHeartbeat: new Date(),
    })
    .where(eq(machines.id, machineId))
    .run();
}

export function markMachineOffline(db: TaskyardDb, machineId: string): void {
  db.update(machines).set({ status: 'offline' }).where(eq(machines.id, machineId)).run();
}

export function listMachines(db: TaskyardDb): MachineWithUtilization[] {
  const rows = db.select().from(machines).all();
  return rows.map((row) => {
    const active = db
      .select({ count: sql<number>`count(*)` })
      .from(threads)
      .where(
        and(eq(threads.machineId, row.id), inArray(threads.status, [...ACTIVE_THREAD_STATUSES])),
      )
      .get();
    const activeThreads = Number(active?.count ?? 0);
    const machine = formatMachine(row, activeThreads);
    const { used, total } = countPortUtilization(
      db,
      row.id,
      row.portRangeStart,
      row.portRangeEnd,
    );
    return { ...machine, port_utilization: { used, total } };
  });
}

export function markOfflineThreadsAsError(db: TaskyardDb, machineId: string): void {
  db.update(threads)
    .set({ status: 'error', completedAt: new Date() })
    .where(
      and(
        eq(threads.machineId, machineId),
        inArray(threads.status, [...ACTIVE_THREAD_STATUSES]),
      ),
    )
    .run();
}
