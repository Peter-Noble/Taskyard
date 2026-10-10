import type { TaskyardDb } from '@taskyard/db';
import { getDb, listAllEvents, listTasks, listThreadEvents } from '@taskyard/core';

type PollFn = (db: TaskyardDb, sinceId: number) => Array<{ id: number }>;

export function createSseResponse(poll: PollFn, sinceParam: string | null): Response {
  const since = Number(sinceParam ?? '0');
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const db = getDb();
      let lastId = since;

      const tick = () => {
        try {
          const items = poll(db, lastId);
          for (const item of items) {
            lastId = Math.max(lastId, item.id);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(item)}\n\n`));
          }
        } catch (err) {
          console.error('SSE poll error:', err);
        }
      };

      tick();
      interval = setInterval(tick, 1000);
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export function threadEventsSse(threadId: string, sinceParam: string | null): Response {
  return createSseResponse(
    (db, sinceId) => listThreadEvents(db, threadId, { sinceId, limit: 100 }),
    sinceParam,
  );
}

export function allEventsSse(sinceParam: string | null): Response {
  return createSseResponse((db, sinceId) => listAllEvents(db, { sinceId, limit: 100 }), sinceParam);
}

/** Pushes the project task list whenever it changes. The first frame is the current list. */
export function projectTasksSse(projectId: string): Response {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const db = getDb();
      let last = '';

      const tick = () => {
        try {
          const payload = JSON.stringify(listTasks(db, { projectId }));
          if (payload === last) return;
          last = payload;
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch (err) {
          console.error('SSE task poll error:', err);
        }
      };

      tick();
      interval = setInterval(tick, 1000);
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
