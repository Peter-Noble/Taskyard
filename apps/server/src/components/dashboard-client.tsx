'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Machine, Project, Thread } from '@taskyard/protocol';
import { AppShell } from '@/components/app-shell';
import { ChatStream, StreamHeaderSub } from '@/components/chat-stream';
import { MachineDock, ThreadRailAside, ThreadRailHead } from '@/components/machine-dock';
import { NewThreadModal } from '@/components/new-thread-modal';
import { LiveTaskDetail, LiveTaskRail } from '@/components/live-task-board';
import { WorkspaceSeams } from '@/components/workspace-seams';
import { type PanelVisibility } from '@/lib/panel-visibility';
import {
  TaskDetailHeader,
  TaskDetailPane,
  TaskRail,
  markTaskReadyForAgent,
} from '@/components/task-rail';
import { useEventStream } from '@/lib/hooks/use-event-stream';
import { useJsonFetch } from '@/lib/hooks/use-json-fetch';
import { isDemoThreadId, useTestData } from '@/lib/hooks/use-test-data';
import { useCollections } from '@/components/collection-provider';
import { projectsInCollection, threadsInCollection } from '@/lib/active-collection';
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
type ProjectsResponse = { projects: Project[] };

export function DashboardClient({ initialPanels }: { initialPanels?: PanelVisibility }) {
  const router = useRouter();
  const { useTestData: testDataOn, hydrated } = useTestData();
  const { active } = useCollections();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [centerMode, setCenterMode] = useState<'chat' | 'task'>('chat');
  const [modalOpen, setModalOpen] = useState(false);
  const [taskTick, setTaskTick] = useState(0);
  const [selectedTaskUpdatedAt, setSelectedTaskUpdatedAt] = useState<string | null>(null);
  const [liveProjectId, setLiveProjectId] = useState<string | null>(null);
  const [composingTask, setComposingTask] = useState(false);

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
  const { data: projectsData } = useJsonFetch<ProjectsResponse>(
    '/api/projects',
    0,
    !testDataOn,
  );

  const threads = testDataOn ? TEST_THREADS : (threadsData?.threads ?? []);
  const machines = testDataOn ? TEST_MACHINES : (machinesData?.machines ?? []);
  const projects = projectsData?.projects ?? [];
  const visibleProjects = useMemo(
    () => (testDataOn ? projects : projectsInCollection(projects, active)),
    [active, projects, testDataOn],
  );
  const visibleThreads = useMemo(
    () => (testDataOn ? threads : threadsInCollection(threads, active)),
    [active, testDataOn, threads],
  );

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
    () => visibleThreads.find((t) => t.id === selectedThreadId) ?? null,
    [visibleThreads, selectedThreadId],
  );

  useEffect(() => {
    if (testDataOn) return;
    if (selectedThread?.project_id) setLiveProjectId(selectedThread.project_id);
  }, [selectedThread?.id, selectedThread?.project_id, testDataOn]);

  useEffect(() => {
    if (testDataOn || liveProjectId || visibleProjects.length === 0) return;
    setLiveProjectId(visibleProjects[0]?.id ?? null);
  }, [testDataOn, liveProjectId, visibleProjects]);

  useEffect(() => {
    if (testDataOn || !active) return;
    if (liveProjectId && visibleProjects.some((project) => project.id === liveProjectId)) return;
    setLiveProjectId(visibleProjects[0]?.id ?? null);
  }, [active, liveProjectId, testDataOn, visibleProjects]);

  const liveTaskOpen = !testDataOn && centerMode === 'task' && !composingTask && Boolean(selectedTaskId);

  const useLiveEvents = Boolean(selectedThreadId) && !testDataOn;
  const events = useEventStream(selectedThreadId, useLiveEvents);
  const threadSlug = selectedThread ? threadTitle(selectedThread) : 'taskyard-ui-wireframe';
  const demoChat = testDataOn && selectedThread ? getTestChatForThread(selectedThread) : null;

  const handleSelectedUpdatedAt = useCallback((updatedAt: string | null) => {
    setSelectedTaskUpdatedAt(updatedAt);
  }, []);

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
    setComposingTask(false);
  }

  function showTaskDetail(taskId: string) {
    setComposingTask(false);
    setSelectedTaskId(taskId);
    setCenterMode('task');
  }

  function handleSelectTask(taskId: string) {
    if (selectedTaskId === taskId && centerMode === 'task' && !composingTask) {
      showChat();
      return;
    }
    showTaskDetail(taskId);
  }

  function handleNewTask() {
    if (testDataOn || !liveProjectId) return;
    setComposingTask(true);
    setSelectedTaskId(null);
    setCenterMode('task');
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

  const taskHead = (
          <header className="panel-head task-rail-head">
            <span className="task-rail-head-label">Tasks</span>
            {!testDataOn ? (
              <div className="task-rail-project-wrap">
                <select
                  className="form-select task-rail-project"
                  aria-label="Project"
                  value={liveProjectId ?? ''}
                  onChange={(event) => setLiveProjectId(event.target.value || null)}
                >
                  {visibleProjects.length === 0 ? <option value="">No projects</option> : null}
                  {visibleProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-rail-new"
              disabled={testDataOn || !liveProjectId}
              onClick={handleNewTask}
            >
              New task
            </button>
          </header>
  );

  const streamHead = liveTaskOpen ? null : (
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
                      className="btn btn-ghost btn-sm"
                      onClick={() => router.push(`/threads/${selectedThread.id}`)}
                    >
                      Thread detail
                    </button>
                  </div>
                ) : null}
              </div>
            ) : testDataOn ? (
              <div className="stream-header-view stream-header-task">
                <div className="stream-header-main">
                  {selectedTaskId ? (
                    <TaskDetailHeader taskId={selectedTaskId} onMarkReady={handleMarkReady} />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="stream-header-view stream-header-task">
                <div className="stream-header-main">
                  <h2 className="stream-title">{composingTask ? 'New task' : 'Task'}</h2>
                </div>
                <div className="stream-header-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={showChat}>
                    Back to thread
                  </button>
                </div>
              </div>
            )}
          </header>
  );

  const threadHead = <ThreadRailHead onNewThread={() => setModalOpen(true)} />;

  const taskBody = testDataOn ? (
            <TaskRail
              key={taskTick}
              useFixtures={testDataOn}
              threadSlug={threadSlug}
              projectId={selectedThread?.project_id ?? null}
              selectedTaskId={selectedTaskId}
              centerMode={centerMode}
              onSelectTask={handleSelectTask}
              onMarkReady={handleMarkReady}
            />
          ) : (
            <LiveTaskRail
              projectId={liveProjectId}
              selectedTaskId={selectedTaskId}
              onSelectTask={handleSelectTask}
              onSelectedUpdatedAt={handleSelectedUpdatedAt}
            />
  );

  const streamBody = (
          <section className="stream-panel" aria-label="Center panel">
            {centerMode === 'chat' ? (
              <div className="center-view">
                <div className="stream-body">
                  {selectedThread ? (
                    <ChatStream
                      thread={selectedThread}
                      events={events}
                      demoChat={demoChat}
                      liveMode={!testDataOn}
                    />
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
                {testDataOn && selectedTaskId ? (
                  <TaskDetailPane taskId={selectedTaskId} onSelectTask={handleSelectTask} />
                ) : null}
                {!testDataOn ? (
                  <LiveTaskDetail
                    projectId={liveProjectId}
                    projects={visibleProjects}
                    taskId={selectedTaskId}
                    composing={composingTask}
                    refreshKey={taskTick}
                    remoteUpdatedAt={selectedTaskUpdatedAt}
                    onSelectTask={handleSelectTask}
                    onChanged={() => setTaskTick((n) => n + 1)}
                    onCreated={(id) => {
                      setComposingTask(false);
                      setSelectedTaskId(id);
                      setCenterMode('task');
                      setTaskTick((n) => n + 1);
                    }}
                    onCancelCreate={showChat}
                  />
                ) : null}
              </div>
            )}
          </section>
  );

  const threadBody = (
          <ThreadRailAside
            threads={visibleThreads}
            selectedThreadId={selectedThreadId}
            onSelect={handleSelectThread}
          />
  );

  const workers = (
        <MachineDock
          machines={machines}
          threads={visibleThreads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
        />
  );

  return (
    <AppShell>
      <WorkspaceSeams
        initialPanels={initialPanels}
        taskHead={taskHead}
        taskBody={taskBody}
        streamHead={streamHead}
        streamBody={streamBody}
        threadHead={threadHead}
        threadBody={threadBody}
        workers={workers}
      />

      <NewThreadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </AppShell>
  );
}
