'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Machine, Thread } from '@taskyard/protocol';
import { AppShell } from '@/components/app-shell';
import { ChatStream, StreamHeaderSub } from '@/components/chat-stream';
import { MachineDock, ThreadRailAside, ThreadRailHead } from '@/components/machine-dock';
import { NewThreadModal } from '@/components/new-thread-modal';
import {
  TaskDetailHeader,
  TaskDetailPane,
  TaskRail,
  markTaskReadyForAgent,
} from '@/components/task-rail';
import { useEventStream } from '@/lib/hooks/use-event-stream';
import { useJsonFetch } from '@/lib/hooks/use-json-fetch';
import { isDemoThreadId, useTestData } from '@/lib/hooks/use-test-data';
import { threadTitle } from '@/lib/format-ui';
import {
  DEFAULT_TEST_THREAD_ID,
  TEST_MACHINES,
  TEST_THREADS,
  getTestChatForThread,
} from '@/lib/test-data/fixtures';

type MachinesResponse = {
  machines: Array<Machine & { port_utilization?: { used: number; total: number } }>;
};

type ThreadsResponse = { threads: Thread[] };

export function DashboardClient() {
  const router = useRouter();
  const { useTestData: testDataOn, hydrated } = useTestData();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [centerMode, setCenterMode] = useState<'chat' | 'task'>('chat');
  const [modalOpen, setModalOpen] = useState(false);
  const [taskTick, setTaskTick] = useState(0);

  const { data: machinesData } = useJsonFetch<MachinesResponse>(
    '/api/machines',
    5000,
    !testDataOn,
  );
  const { data: threadsData, refresh: refreshThreads } = useJsonFetch<ThreadsResponse>(
    '/api/threads',
    5000,
    !testDataOn,
  );

  const threads = testDataOn ? TEST_THREADS : (threadsData?.threads ?? []);
  const machines = testDataOn ? TEST_MACHINES : (machinesData?.machines ?? []);

  useEffect(() => {
    if (!hydrated) return;
    if (testDataOn) {
      setSelectedThreadId((prev) => (prev && isDemoThreadId(prev) ? prev : DEFAULT_TEST_THREAD_ID));
      setCenterMode('chat');
      setSelectedTaskId(null);
    } else {
      setSelectedThreadId((prev) => (prev && isDemoThreadId(prev) ? null : prev));
      setSelectedTaskId(null);
      setCenterMode('chat');
    }
  }, [testDataOn, hydrated]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  );

  const useLiveEvents = Boolean(selectedThreadId) && !testDataOn;
  const events = useEventStream(selectedThreadId, useLiveEvents);
  const threadSlug = selectedThread ? threadTitle(selectedThread) : 'taskyard-ui-wireframe';
  const demoChat = testDataOn && selectedThread ? getTestChatForThread(selectedThread) : null;

  const handleMarkReady = useCallback(
    (taskId: string) => {
      if (!testDataOn) return;
      markTaskReadyForAgent(taskId);
      setTaskTick((n) => n + 1);
    },
    [testDataOn],
  );

  function showChat() {
    setCenterMode('chat');
    setSelectedTaskId(null);
  }

  function showTaskDetail(taskId: string) {
    if (!testDataOn) return;
    setSelectedTaskId(taskId);
    setCenterMode('task');
  }

  function handleSelectTask(taskId: string) {
    if (!testDataOn) return;
    if (selectedTaskId === taskId && centerMode === 'task') {
      showChat();
      return;
    }
    showTaskDetail(taskId);
  }

  function handleSelectThread(id: string) {
    setSelectedThreadId(id);
    showChat();
  }

  function handleCreated(id: string) {
    refreshThreads();
    setSelectedThreadId(id);
    showChat();
  }

  const streamTitle =
    centerMode === 'task' && selectedTaskId
      ? null
      : selectedThread
        ? threadTitle(selectedThread)
        : 'Select a thread';

  return (
    <AppShell>
      <div className="workspace">
        <div className="workspace-body">
          <header className="panel-head task-rail-head">
            <span className="task-rail-head-label">Tasks</span>
            <button type="button" className="btn btn-primary btn-rail-new" disabled={!testDataOn}>
              New task
            </button>
          </header>

          <header
            className="panel-head stream-header"
            aria-label={centerMode === 'task' ? 'Selected task' : 'Selected thread'}
          >
            {centerMode === 'chat' ? (
              <div className="stream-header-view">
                <div className="stream-header-main">
                  <h2 className="stream-title">{streamTitle}</h2>
                  <p className="stream-sub">
                    {selectedThread ? (
                      <StreamHeaderSub thread={selectedThread} />
                    ) : (
                      'Choose a thread from the rail or machine dock'
                    )}
                  </p>
                </div>
                {selectedThread ? (
                  <div className="stream-header-actions">
                    <button
                      type="button"
                      className="btn-editor"
                      aria-label="Open in Cursor"
                      title="Open in Cursor"
                      onClick={() => router.push(`/threads/${selectedThread.id}`)}
                    >
                      <span className="spec-mono" style={{ fontSize: 11 }}>
                        Cursor
                      </span>
                    </button>
                    <button
                      type="button"
                      className="btn-editor"
                      aria-label="Open thread detail"
                      title="Open thread detail"
                      onClick={() => router.push(`/threads/${selectedThread.id}`)}
                    >
                      <span className="spec-mono" style={{ fontSize: 11 }}>
                        Detail
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="stream-header-view stream-header-task">
                <div className="stream-header-main">
                  {selectedTaskId ? (
                    <TaskDetailHeader taskId={selectedTaskId} onMarkReady={handleMarkReady} />
                  ) : null}
                </div>
              </div>
            )}
          </header>

          <ThreadRailHead onNewThread={() => setModalOpen(true)} />

          <TaskRail
            key={taskTick}
            enabled={testDataOn}
            threadSlug={threadSlug}
            selectedTaskId={selectedTaskId}
            centerMode={centerMode}
            onSelectTask={handleSelectTask}
            onMarkReady={handleMarkReady}
          />

          <section className="stream-panel" aria-label="Center panel">
            {centerMode === 'chat' ? (
              <div className="center-view">
                <div className="stream-body">
                  {selectedThread ? (
                    <ChatStream thread={selectedThread} events={events} demoChat={demoChat} />
                  ) : (
                    <div className="empty-state" style={{ padding: 'var(--space-5)' }}>
                      {testDataOn
                        ? 'Select a thread to view the conversation.'
                        : 'No thread selected. Create one or pick from the rail when workers are connected.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="center-view task-detail-view">
                {selectedTaskId ? (
                  <TaskDetailPane taskId={selectedTaskId} onSelectTask={handleSelectTask} />
                ) : null}
              </div>
            )}
          </section>

          <ThreadRailAside
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelect={handleSelectThread}
          />
        </div>

        <MachineDock
          machines={machines}
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
        />
      </div>

      <NewThreadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </AppShell>
  );
}
