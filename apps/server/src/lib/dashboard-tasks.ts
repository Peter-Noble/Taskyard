export type TaskStatus =
  | 'ready'
  | 'in-progress'
  | 'review'
  | 'waiting'
  | 'completed'
  | 'backlog';

export type TaskRef = { id: string; label: string };

export type TaskActivity =
  | { type: 'comment'; actor: string; text: string; time: string }
  | { type: 'status'; actor: string; from: string; to: string; time: string }
  | { type: 'attachment'; actor: string; name: string; size: string; time: string }
  | { type: 'dependency'; actor: string; text: string; time: string };

export type DashboardTask = {
  id: string;
  num: string;
  title: string;
  status: TaskStatus;
  statusLabel: string;
  assignee: string;
  created: string;
  description: string;
  blockedBy: TaskRef[];
  blocks: TaskRef[];
  activity: TaskActivity[];
  tags?: string[];
};

export type DashboardProject = {
  name: string;
  repo: string;
  tasks: DashboardTask[];
};

export const THREAD_PROJECT: Record<string, string> = {
  'invoice-pdf-parser': 'invoices',
  'taskyard-ui-wireframe': 'taskyard',
  'migrate-auth-to-clerk': 'taskyard',
  'fix-port-forward-leak': 'infra',
  'openapi-client-gen': 'taskyard',
  'readme-refresh': 'taskyard',
};

export const PROJECT_ORDER = ['taskyard', 'invoices', 'infra'] as const;

export const PROJECTS: Record<string, DashboardProject> = {
  taskyard: {
    name: 'Taskyard',
    repo: 'peter/taskyard',
    tasks: [
      {
        id: 'ty-12',
        num: '12',
        title: 'Auth middleware baseline',
        status: 'in-progress',
        statusLabel: 'In progress',
        assignee: 'Peter',
        created: 'May 16',
        description:
          'Session cookies, API key lookup, and worker-scoped tokens. Required before any route handlers or UI that calls the API.',
        blockedBy: [],
        blocks: [
          { id: 'ty-13', label: 'TY-13' },
          { id: 'ty-19', label: 'TY-19' },
        ],
        activity: [
          { type: 'status', actor: 'Peter', from: 'Ready for agent', to: 'In progress', time: 'May 17' },
          {
            type: 'comment',
            actor: 'Peter',
            text: 'Keep middleware stateless — Redis for session store only.',
            time: 'May 16',
          },
        ],
      },
      {
        id: 'ty-19',
        num: '19',
        title: 'API key rotation + worker token TTL',
        status: 'backlog',
        statusLabel: 'Backlog',
        assignee: 'Peter',
        created: 'May 16',
        description:
          'Rotate user API keys on demand and expire worker-scoped tokens after 24h. Shares session store with TY-12 middleware.',
        blockedBy: [{ id: 'ty-12', label: 'TY-12' }],
        blocks: [],
        activity: [
          {
            type: 'comment',
            actor: 'Peter',
            text: 'Document rotation in OpenAPI before TY-13 routes ship.',
            time: 'May 16',
          },
        ],
      },
      {
        id: 'ty-13',
        num: '13',
        title: 'REST API v1 routes',
        status: 'in-progress',
        statusLabel: 'In progress',
        assignee: 'Peter',
        created: 'May 17',
        description:
          'Threads, tasks, machines, and port-forward endpoints. OpenAPI spec must match before dashboard wiring.',
        blockedBy: [{ id: 'ty-12', label: 'TY-12' }],
        blocks: [{ id: 'ty-14', label: 'TY-14' }],
        activity: [
          { type: 'dependency', actor: 'Peter', text: 'Blocked by TY-12 (auth middleware)', time: 'May 17' },
          { type: 'status', actor: 'Agent', from: 'Ready for agent', to: 'In progress', time: 'May 18' },
        ],
      },
      {
        id: 'ty-14',
        num: '14',
        title: 'Dashboard workspace — chat, threads, machine dock',
        status: 'in-progress',
        statusLabel: 'In progress',
        assignee: 'Peter',
        created: 'May 18',
        description:
          'Single-screen dashboard: center LLM chat, right thread rail with history break, bottom machine tiles with per-thread buttons and 4-cell load meters.',
        blockedBy: [
          { id: 'ty-11', label: 'TY-11' },
          { id: 'ty-13', label: 'TY-13' },
        ],
        blocks: [{ id: 'ty-15', label: 'TY-15' }],
        activity: [
          { type: 'status', actor: 'Peter', from: 'Ready for agent', to: 'In progress', time: 'Today 09:12' },
          {
            type: 'comment',
            actor: 'Peter',
            text: 'Drop rounded corners entirely — thin 1px borders only.',
            time: 'Today 08:40',
          },
          { type: 'attachment', actor: 'Peter', name: 'high-contrast-reference.webp', size: '48 KB', time: 'Yesterday' },
          { type: 'status', actor: 'Peter', from: 'Backlog', to: 'Ready for agent', time: 'May 19' },
        ],
      },
      {
        id: 'ty-15',
        num: '15',
        title: 'Layout review before visual polish',
        status: 'waiting',
        statusLabel: 'Waiting for user',
        assignee: 'Peter',
        created: 'May 20',
        description:
          'Dashboard shell is in place. Confirm layout in the thread chat before the agent continues wireframe iterations.',
        blockedBy: [{ id: 'ty-14', label: 'TY-14' }],
        blocks: [{ id: 'ty-17', label: 'TY-17' }],
        activity: [
          {
            type: 'comment',
            actor: 'Agent',
            text: 'Dashboard shell is ready — reply with layout feedback to continue.',
            time: 'Today 09:05',
          },
          { type: 'status', actor: 'Agent', from: 'In progress', to: 'Waiting for user', time: 'Today 09:04' },
          {
            type: 'dependency',
            actor: 'Peter',
            text: 'Linked blocker TY-14 (layout shell must land first)',
            time: 'May 20',
          },
        ],
      },
      {
        id: 'ty-17',
        num: '17',
        title: 'E2E smoke — dashboard, threads, task rail',
        status: 'ready',
        statusLabel: 'Ready for agent',
        assignee: '—',
        created: 'May 23',
        description:
          'Playwright suite against local stack: thread selection, task dependency expand, machine dock thread buttons. Runs after layout sign-off.',
        blockedBy: [{ id: 'ty-15', label: 'TY-15' }],
        blocks: [],
        activity: [
          { type: 'dependency', actor: 'Peter', text: 'Blocked by TY-15 (layout review)', time: 'May 23' },
          { type: 'status', actor: 'Peter', from: 'Backlog', to: 'Ready for agent', time: 'May 23' },
        ],
      },
      {
        id: 'ty-11',
        num: '11',
        title: 'Shared CSS tokens — light theme, zero radius',
        status: 'completed',
        statusLabel: 'Completed',
        assignee: 'Peter',
        created: 'May 17',
        description: 'Extract taskyard.css with oklch tokens, entity labels, badge system, and workspace grid.',
        blockedBy: [],
        blocks: [{ id: 'ty-14', label: 'TY-14' }],
        activity: [
          { type: 'status', actor: 'Peter', from: 'In progress', to: 'Completed', time: 'May 18' },
          { type: 'attachment', actor: 'Peter', name: 'logo_8.jpeg', size: '12 KB', time: 'May 17' },
          {
            type: 'comment',
            actor: 'Peter',
            text: 'Match Expo-adjacent light canvas but keep our own accent.',
            time: 'May 17',
          },
        ],
      },
      {
        id: 'ty-16',
        num: '16',
        title: 'OpenAPI client — default auth scheme',
        status: 'waiting',
        statusLabel: 'Waiting for user',
        assignee: 'Peter',
        created: 'May 21',
        description:
          'taskyard.v1.yaml lists Bearer JWT and x-api-key. Decide factory default before codegen merge.',
        blockedBy: [],
        blocks: [],
        activity: [
          {
            type: 'comment',
            actor: 'Agent',
            text: 'Which auth path should clients/ts/index.ts use by default?',
            time: 'Today 07:30',
          },
          { type: 'status', actor: 'Agent', from: 'Ready for agent', to: 'Waiting for user', time: 'Today 07:29' },
        ],
      },
      {
        id: 'ty-09',
        num: '09',
        title: 'Machines list — port utilization segments',
        status: 'ready',
        statusLabel: 'Ready for agent',
        assignee: '—',
        created: 'May 22',
        tags: ['machines', 'wireframe'],
        description:
          'Second screen: worker rows with IP, CPU/RAM/GPU specs, thread counts, segmented port-range bars.',
        blockedBy: [],
        blocks: [],
        activity: [{ type: 'status', actor: 'Peter', from: 'Backlog', to: 'Ready for agent', time: 'Today' }],
      },
      {
        id: 'ty-18',
        num: '18',
        title: 'Auto rules — run history log per rule',
        status: 'backlog',
        statusLabel: 'Backlog',
        assignee: 'Peter',
        created: 'Today',
        tags: [],
        description:
          'Each auto rule should show last run time, outcome (created task / skipped / error), and a link to the spawned task. Collapse older runs behind “Show more”.',
        blockedBy: [],
        blocks: [],
        activity: [
          {
            type: 'comment',
            actor: 'Peter',
            text: 'Match Machines table density — monospace timestamps, no cards.',
            time: 'Today 10:41',
          },
          {
            type: 'comment',
            actor: 'Peter',
            text: 'Include webhook delivery id when trigger was an external event.',
            time: 'Today 10:38',
          },
          { type: 'attachment', actor: 'Peter', name: 'run-history-sketch.png', size: '31 KB', time: 'Today 10:35' },
        ],
      },
    ],
  },
  invoices: {
    name: 'Invoice Parser',
    repo: 'peter/invoice-tools',
    tasks: [
      {
        id: 'inv-01',
        num: '01',
        title: 'Schema v2 — line items + tax fields',
        status: 'in-progress',
        statusLabel: 'In progress',
        assignee: 'Peter',
        created: 'May 19',
        description:
          'JSON schema for extracted rows; breaking change from v1. Blocks OCR pipeline and all downstream review.',
        blockedBy: [],
        blocks: [{ id: 'inv-02', label: 'INV-02' }],
        activity: [
          { type: 'comment', actor: 'Peter', text: 'Align tax_code enum with accountant spreadsheet.', time: 'May 19' },
          { type: 'status', actor: 'Peter', from: 'Ready for agent', to: 'In progress', time: 'May 20' },
        ],
      },
      {
        id: 'inv-02',
        num: '02',
        title: 'OCR pipeline upgrade (Tesseract 5)',
        status: 'in-progress',
        statusLabel: 'In progress',
        assignee: 'Agent',
        created: 'May 20',
        description: 'Retrain table detector on v2 schema samples. Must land before row-level review queue.',
        blockedBy: [{ id: 'inv-01', label: 'INV-01' }],
        blocks: [{ id: 'inv-03', label: 'INV-03' }],
        activity: [
          { type: 'dependency', actor: 'Agent', text: 'Blocked by INV-01 (schema v2)', time: 'May 20' },
          { type: 'status', actor: 'Agent', from: 'Ready for agent', to: 'In progress', time: 'May 21' },
        ],
      },
      {
        id: 'inv-03',
        num: '03',
        title: 'Review low-confidence extraction rows',
        status: 'waiting',
        statusLabel: 'Waiting for user',
        assignee: 'Peter',
        created: 'May 21',
        description: '14 rows scored below 0.85 — approve corrections or skip batch review.',
        blockedBy: [{ id: 'inv-02', label: 'INV-02' }],
        blocks: [{ id: 'inv-04', label: 'INV-04' }],
        activity: [
          { type: 'comment', actor: 'Agent', text: 'Three amount fields misaligned in inv-1042.pdf.', time: 'Today 06:10' },
          { type: 'attachment', actor: 'Agent', name: 'review-queue.csv', size: '8 KB', time: 'Today 06:08' },
          { type: 'status', actor: 'Agent', from: 'In progress', to: 'Waiting for user', time: 'Today 06:07' },
        ],
      },
      {
        id: 'inv-04',
        num: '04',
        title: 'Batch remaining PDFs after review',
        status: 'ready',
        statusLabel: 'Ready for agent',
        assignee: '—',
        created: 'May 21',
        description: 'Run schema v2 export once inv-03 is cleared.',
        blockedBy: [{ id: 'inv-03', label: 'INV-03' }],
        blocks: [],
        activity: [
          { type: 'dependency', actor: 'Agent', text: 'Blocked by INV-03 (user review)', time: 'Today 06:11' },
        ],
      },
    ],
  },
  infra: {
    name: 'Homelab Infra',
    repo: 'peter/homelab',
    tasks: [
      {
        id: 'inf-05',
        num: '05',
        title: 'Network policy audit — worker ingress',
        status: 'ready',
        statusLabel: 'Ready for agent',
        assignee: 'Peter',
        created: 'May 20',
        description: 'Document allowed port ranges per worker class before automating forwards.',
        blockedBy: [],
        blocks: [{ id: 'inf-06', label: 'INF-06' }],
        activity: [{ type: 'status', actor: 'Peter', from: 'Backlog', to: 'Ready for agent', time: 'May 21' }],
      },
      {
        id: 'inf-06',
        num: '06',
        title: 'Port range allocator service',
        status: 'in-progress',
        statusLabel: 'In progress',
        assignee: 'Peter',
        created: 'May 21',
        description: 'Assigns non-overlapping ranges per thread; prevents 21116 collisions seen in homelab logs.',
        blockedBy: [{ id: 'inf-05', label: 'INF-05' }],
        blocks: [{ id: 'inf-07', label: 'INF-07' }],
        activity: [
          { type: 'dependency', actor: 'Peter', text: 'Blocked by INF-05 (policy audit)', time: 'May 21' },
          {
            type: 'comment',
            actor: 'Agent',
            text: 'Suggested default pool 5900–5999 for dev workers.',
            time: 'May 22',
          },
        ],
      },
      {
        id: 'inf-07',
        num: '07',
        title: 'Clear stale port-forward on 21116',
        status: 'in-progress',
        statusLabel: 'In progress',
        assignee: 'Peter',
        created: 'May 22',
        description: 'kubectl forward failed — pid 8842 still listening. Kill or rebind before agent retry.',
        blockedBy: [{ id: 'inf-06', label: 'INF-06' }],
        blocks: [],
        activity: [
          { type: 'comment', actor: 'Agent', text: 'bind: address already in use on 0.0.0.0:21116', time: 'Today 08:55' },
          { type: 'status', actor: 'Agent', from: 'Ready for agent', to: 'In progress', time: 'Today 08:54' },
        ],
      },
    ],
  },
};

export type TaskLookup = {
  task: DashboardTask;
  project: DashboardProject;
  projectKey: string;
};

export function findTask(taskId: string): TaskLookup | null {
  for (const key of PROJECT_ORDER) {
    const project = PROJECTS[key];
    const task = project?.tasks.find((t) => t.id === taskId);
    if (task) return { task, project, projectKey: key };
  }
  return null;
}

export function isTaskBlocked(task: DashboardTask): boolean {
  if (!task.blockedBy.length) return false;
  return task.blockedBy.some((dep) => {
    const found = findTask(dep.id);
    if (!found) return true;
    return found.task.status !== 'completed';
  });
}

export function getDependentTasks(parentTask: DashboardTask): DashboardTask[] {
  const all = PROJECT_ORDER.flatMap((key) => PROJECTS[key]?.tasks ?? []);
  return all.filter(
    (t) =>
      t.id !== parentTask.id &&
      isTaskBlocked(t) &&
      t.blockedBy.some((dep) => dep.id === parentTask.id),
  );
}

export function taskHasOpenDependents(task: DashboardTask): boolean {
  return getDependentTasks(task).length > 0;
}

export function isInDependentSubtree(
  taskId: string | null,
  rootTask: DashboardTask,
): boolean {
  if (!taskId || taskId === rootTask.id) return taskId === rootTask.id;
  return getDependentTasks(rootTask).some(
    (dep) => dep.id === taskId || isInDependentSubtree(taskId, dep),
  );
}

export function shouldExpandDependents(
  parentTask: DashboardTask,
  centerMode: 'chat' | 'task',
  selectedTaskId: string | null,
): boolean {
  if (!getDependentTasks(parentTask).length) return false;
  if (centerMode !== 'task' || !selectedTaskId) return false;
  return isInDependentSubtree(selectedTaskId, parentTask);
}

export function collectShownDependentIds(
  centerMode: 'chat' | 'task',
  selectedTaskId: string | null,
): Set<string> {
  const ids = new Set<string>();
  function walk(parentTask: DashboardTask) {
    if (!shouldExpandDependents(parentTask, centerMode, selectedTaskId)) return;
    getDependentTasks(parentTask).forEach((dep) => {
      ids.add(dep.id);
      walk(dep);
    });
  }
  PROJECT_ORDER.forEach((key) => {
    (PROJECTS[key]?.tasks ?? []).forEach((task) => walk(task));
  });
  return ids;
}

export function taskStatusBadgeClass(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    ready: 'badge-task-ready',
    'in-progress': 'badge-task-progress',
    review: 'badge-task-review',
    waiting: 'badge-task-waiting',
    completed: 'badge-task-done',
    backlog: 'badge-task-backlog',
  };
  return map[status] ?? 'badge-task-backlog';
}

export function showsReadyForAgentAction(task: DashboardTask): boolean {
  return !['ready', 'in-progress', 'review', 'waiting', 'completed'].includes(task.status);
}

export function threadProjectKey(threadSlug: string): string {
  return THREAD_PROJECT[threadSlug] ?? 'taskyard';
}
