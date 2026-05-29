'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Machine, ThreadDetail } from '@taskyard/protocol';
import { AppShell } from '@/components/app-shell';
import { EventTerminal, FilterTabs } from '@/components/event-terminal';
import { NewThreadModal } from '@/components/new-thread-modal';
import { useEventStream } from '@/lib/hooks/use-event-stream';
import { useJsonFetch } from '@/lib/hooks/use-json-fetch';
import { useTestData } from '@/lib/hooks/use-test-data';
import {
  type EventFilter,
  formatAgentLabel,
  formatDuration,
  threadTitle,
} from '@/lib/format-ui';
import { TEST_MACHINES, getTestThreadDetail } from '@/lib/test-data/fixtures';

type ThreadDetailClientProps = {
  initialThread?: ThreadDetail;
  demoThreadId?: string;
};

export function ThreadDetailClient({ initialThread, demoThreadId }: ThreadDetailClientProps) {
  const router = useRouter();
  const { useTestData: testDataOn, hydrated } = useTestData();
  const isDemo = Boolean(demoThreadId);

  const demoThread = useMemo(
    () => (demoThreadId ? getTestThreadDetail(demoThreadId) : null),
    [demoThreadId],
  );

  const [thread, setThread] = useState<ThreadDetail | null>(initialThread ?? demoThread);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (isDemo && hydrated) {
      setThread(testDataOn ? getTestThreadDetail(demoThreadId!) : null);
    } else if (initialThread) {
      setThread(initialThread);
    }
  }, [isDemo, demoThreadId, testDataOn, hydrated, initialThread]);

  const useLiveEvents = Boolean(thread?.id) && !isDemo;
  const events = useEventStream(thread?.id ?? null, useLiveEvents);

  const { data: machinesData } = useJsonFetch<{ machines: Machine[] }>(
    '/api/machines',
    10000,
    !isDemo && !testDataOn,
  );

  const machineIp = useMemo(() => {
    if (!thread?.machine_id) return null;
    if (isDemo || testDataOn) {
      return TEST_MACHINES.find((m) => m.id === thread.machine_id)?.ip_address ?? null;
    }
    return machinesData?.machines.find((m) => m.id === thread.machine_id)?.ip_address ?? null;
  }, [machinesData, thread?.machine_id, isDemo, testDataOn]);

  const refreshThread = useCallback(async () => {
    if (!thread || isDemo) return;
    const res = await fetch(`/api/threads/${thread.id}`);
    if (res.ok) {
      const data = await res.json();
      setThread(data.thread);
    }
  }, [thread, isDemo]);

  async function runAction(action: 'kill' | 'close') {
    if (!thread || isDemo) return;
    setActing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/threads/${thread.id}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${action} failed`);
      setThread((prev) => (prev ? { ...prev, ...data.thread, events: prev.events } : prev));
      await refreshThread();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setActing(false);
    }
  }

  if (!hydrated) {
    return (
      <AppShell pageTitle="Thread">
        <div className="main-padded">
          <p className="empty-state">Loading…</p>
        </div>
      </AppShell>
    );
  }

  if (isDemo && !testDataOn) {
    return (
      <AppShell pageTitle="Thread">
        <div className="main-padded">
          <p className="empty-state">
            This is a demo thread. Turn on <strong>Test data</strong> in the header to view it.
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  if (!thread) {
    return (
      <AppShell pageTitle="Thread">
        <div className="main-padded">
          <p className="empty-state">Thread not found.</p>
        </div>
      </AppShell>
    );
  }

  const canKill = !isDemo && ['pending', 'spawning', 'running', 'paused'].includes(thread.status);
  const canClose = !isDemo && ['completed', 'error'].includes(thread.status);

  const webUrl = thread.web_port && machineIp ? `http://${machineIp}:${thread.web_port}` : null;
  const vncUrl = thread.vnc_port && machineIp ? `vnc://${machineIp}:${thread.vnc_port}` : null;
  const terminalEvents = isDemo ? thread.events : events.length ? events : thread.events;

  return (
    <AppShell
      pageTitle={threadTitle(thread)}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)} disabled={isDemo}>
            New Thread
          </button>
        </>
      }
    >
      <div className="main-padded">
        <div className="detail-layout">
          <section className="card" style={{ padding: 'var(--space-4)', minHeight: 0 }}>
            <FilterTabs filter={filter} onChange={setFilter} />
            <EventTerminal
              events={terminalEvents}
              filter={filter}
              emptyMessage="Waiting for agent events…"
              minHeight={420}
            />
          </section>

          <aside className="card detail-sidebar">
            <h2 className="card-title">Project</h2>
            <dl className="meta-dl">
              <dt>Repository</dt>
              <dd>{thread.project_name ?? thread.project_id}</dd>
              <dt>Branch</dt>
              <dd>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{thread.branch}</code>
              </dd>
              <dt>Agent</dt>
              <dd>
                <span className="agent-tag">{formatAgentLabel(thread.agent_type)}</span>
              </dd>
              <dt>Machine</dt>
              <dd>
                {thread.machine_name ?? '—'}
                {machineIp ? ` · ${machineIp}` : ''}
              </dd>
              <dt>Started</dt>
              <dd>
                {thread.started_at
                  ? `${new Date(thread.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${formatDuration(thread.started_at ?? thread.created_at)} ago`
                  : formatDuration(thread.created_at)}
              </dd>
            </dl>

            <h2 className="card-title">Ports</h2>
            <div className="port-links">
              {thread.vnc_port ? (
                <a
                  className="port-chip"
                  href={vncUrl ?? '#'}
                  onClick={(e) => {
                    if (!vncUrl) e.preventDefault();
                  }}
                >
                  VNC :{thread.vnc_port}
                </a>
              ) : null}
              {thread.web_port ? (
                <a
                  className="port-chip"
                  href={webUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!webUrl) e.preventDefault();
                  }}
                >
                  Web :{thread.web_port}
                </a>
              ) : null}
              {!thread.web_port && !thread.vnc_port ? (
                <span className="spec-mono">—</span>
              ) : null}
            </div>

            <div className="action-stack">
              {canKill ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={acting}
                  onClick={() => runAction('kill')}
                >
                  Kill thread
                </button>
              ) : null}
              {canClose ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={acting}
                  onClick={() => runAction('close')}
                >
                  Close
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost" onClick={() => router.push('/dashboard')}>
                Back to dashboard
              </button>
            </div>
            {actionError ? <p className="modal-error">{actionError}</p> : null}
          </aside>
        </div>
      </div>

      <NewThreadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => router.push(`/threads/${id}`)}
      />
    </AppShell>
  );
}
