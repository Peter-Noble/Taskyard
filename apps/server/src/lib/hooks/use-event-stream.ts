'use client';

import { useEffect, useRef, useState } from 'react';
import type { ThreadEvent } from '@taskyard/protocol';

export function useEventStream(threadId: string | null, enabled = true) {
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const lastIdRef = useRef(0);

  useEffect(() => {
    if (!threadId || !enabled) {
      setEvents([]);
      lastIdRef.current = 0;
      return;
    }

    let cancelled = false;
    let source: EventSource | null = null;
    lastIdRef.current = 0;
    setEvents([]);

    (async () => {
      try {
        const res = await fetch(`/api/threads/${threadId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.thread?.events) return;
        const initial = data.thread.events as ThreadEvent[];
        setEvents(initial);
        if (initial.length > 0) {
          lastIdRef.current = Math.max(...initial.map((e) => e.id));
        }
      } catch (err) {
        console.error(err);
      }

      if (cancelled) return;

      source = new EventSource(
        `/api/threads/${threadId}/events?since=${lastIdRef.current}`,
      );

      source.onmessage = (msg) => {
        try {
          const item = JSON.parse(msg.data) as ThreadEvent;
          lastIdRef.current = Math.max(lastIdRef.current, item.id);
          setEvents((prev) => {
            if (prev.some((e) => e.id === item.id)) return prev;
            return [...prev, item];
          });
        } catch {
          // ignore malformed SSE payloads
        }
      };

      source.onerror = () => {
        source?.close();
      };
    })();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [threadId, enabled]);

  return events;
}
