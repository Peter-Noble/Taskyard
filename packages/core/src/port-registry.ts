import { portAllocations } from '@taskyard/db';
import { and, eq } from 'drizzle-orm';
import type { TaskyardDb } from '@taskyard/db';
import { getMachineById } from './machines.js';

export class PortExhaustedError extends Error {
  constructor(machineId: string) {
    super(`No free ports on machine ${machineId}`);
    this.name = 'PortExhaustedError';
  }
}

export function allocatePorts(
  db: TaskyardDb,
  machineId: string,
  threadId: string,
): { web: number; vnc: number } {
  const machine = getMachineById(db, machineId);
  if (!machine) throw new Error(`Machine not found: ${machineId}`);

  return db.transaction(() => {
    const used = new Set(
      db
        .select({ port: portAllocations.port })
        .from(portAllocations)
        .where(eq(portAllocations.machineId, machineId))
        .all()
        .map((r) => r.port),
    );

    let web: number | undefined;
    let vnc: number | undefined;

    for (let p = machine.portRangeStart; p <= machine.portRangeEnd; p++) {
      if (used.has(p)) continue;
      if (web === undefined) web = p;
      else {
        vnc = p;
        break;
      }
    }

    if (web === undefined || vnc === undefined) {
      throw new PortExhaustedError(machineId);
    }

    const now = new Date();
    db.insert(portAllocations)
      .values({ port: web, machineId, threadId, purpose: 'web', allocatedAt: now })
      .run();
    db.insert(portAllocations)
      .values({ port: vnc, machineId, threadId, purpose: 'vnc', allocatedAt: now })
      .run();

    return { web, vnc };
  });
}

export function releasePorts(db: TaskyardDb, threadId: string): void {
  db.delete(portAllocations).where(eq(portAllocations.threadId, threadId)).run();
}

export function getAllocatedPorts(db: TaskyardDb, machineId: string): number[] {
  return db
    .select({ port: portAllocations.port })
    .from(portAllocations)
    .where(eq(portAllocations.machineId, machineId))
    .all()
    .map((r) => r.port);
}

export function countPortUtilization(
  db: TaskyardDb,
  machineId: string,
  rangeStart: number,
  rangeEnd: number,
): { used: number; total: number } {
  const used = getAllocatedPorts(db, machineId).length;
  const total = rangeEnd - rangeStart + 1;
  return { used, total };
}
