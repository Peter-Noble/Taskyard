import { machines } from '@taskyard/db';
import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import type { TaskyardDb } from '@taskyard/db';
import { markMachineOffline, markOfflineThreadsAsError } from './machines.js';

const HEARTBEAT_TIMEOUT_MS = 90_000;

export function checkDeadWorkers(db: TaskyardDb): string[] {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
  const stale = db
    .select()
    .from(machines)
    .where(
      and(
        inArray(machines.status, ['online', 'busy']),
        or(isNull(machines.lastHeartbeat), lt(machines.lastHeartbeat, cutoff)),
      ),
    )
    .all();

  const marked: string[] = [];
  for (const m of stale) {
    markMachineOffline(db, m.id);
    markOfflineThreadsAsError(db, m.id);
    marked.push(m.id);
  }
  return marked;
}
