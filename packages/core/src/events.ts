import { events } from '@taskyard/db';
import { and, eq, gt } from 'drizzle-orm';
import type { TaskyardDb } from '@taskyard/db';
import type { AgentEvent } from '@taskyard/protocol';
import { formatEvent } from './format.js';

export function appendEvent(db: TaskyardDb, threadId: string, payload: AgentEvent): number {
  const eventType = payload.type;
  const result = db
    .insert(events)
    .values({
      threadId,
      eventType,
      payload: JSON.stringify(payload),
      timestamp: new Date(),
    })
    .returning({ id: events.id })
    .get();

  return result?.id ?? 0;
}

export function listThreadEvents(
  db: TaskyardDb,
  threadId: string,
  opts?: { sinceId?: number; limit?: number },
) {
  const limit = opts?.limit ?? 50;
  const rows =
    opts?.sinceId !== undefined
      ? db
          .select()
          .from(events)
          .where(and(eq(events.threadId, threadId), gt(events.id, opts.sinceId)))
          .orderBy(events.id)
          .limit(limit)
          .all()
      : db
          .select()
          .from(events)
          .where(eq(events.threadId, threadId))
          .orderBy(events.id)
          .limit(limit)
          .all();
  return rows.map(formatEvent);
}

export function listAllEvents(db: TaskyardDb, opts?: { sinceId?: number; limit?: number }) {
  const limit = opts?.limit ?? 100;
  const rows =
    opts?.sinceId !== undefined
      ? db
          .select()
          .from(events)
          .where(gt(events.id, opts.sinceId))
          .orderBy(events.id)
          .limit(limit)
          .all()
      : db.select().from(events).orderBy(events.id).limit(limit).all();

  return rows.map(formatEvent);
}
