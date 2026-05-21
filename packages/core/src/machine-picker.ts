import { machines } from '@taskyard/db';
import { eq } from 'drizzle-orm';
import type { TaskyardDb } from '@taskyard/db';

export class NoMachineAvailableError extends Error {
  constructor() {
    super('No online workers available');
    this.name = 'NoMachineAvailableError';
  }
}

export function pickMachine(db: TaskyardDb, manualId?: string): string {
  if (manualId) {
    const m = db.select().from(machines).where(eq(machines.id, manualId)).get();
    if (!m) throw new Error(`Machine not found: ${manualId}`);
    if (m.status !== 'online') throw new Error(`Machine ${manualId} is not online`);
    return manualId;
  }

  const online = db.select().from(machines).where(eq(machines.status, 'online')).all();
  if (online.length === 0) throw new NoMachineAvailableError();

  let best = online[0]!;
  let bestScore = machineScore(best);

  for (const m of online.slice(1)) {
    const score = machineScore(m);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }

  return best.id;
}

function machineScore(m: typeof machines.$inferSelect): number {
  const ramHeadroom = (m.ramGb ?? 0) - (m.ramUsedGb ?? 0);
  const cpuHeadroom = 100 - (m.cpuPercent ?? 100);
  return ramHeadroom * 10 + cpuHeadroom;
}
