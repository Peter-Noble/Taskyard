import type { Machine, Project, Thread, ThreadDetail, ThreadEvent } from '@taskyard/protocol';

const isoMinutesAgo = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

export type TestChatMessage = {
  role: 'user' | 'assistant' | 'system';
  text: string;
};

export type TestChatFixture = {
  waiting: boolean;
  waitingPrompt?: string;
  messages: TestChatMessage[];
};

export type OverviewItem = {
  id: string;
  kind: string;
  title: string;
  meta: string;
  badgeClass: string;
  badgeLabel: string;
  facts: { dt: string; dd: string }[];
  note: string;
  actions: { label: string; href?: string; variant?: 'primary' | 'ghost' | 'danger' }[];
};

export type TestAutoRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: 'event' | 'schedule' | 'combined';
  lastRun: string;
  taskTitle: string;
  taskDesc: string;
  project: string;
  tags: string[];
  eventSource?: string;
  eventType?: string;
  eventRepo?: string;
  schedFreq?: string;
  schedDay?: string;
  schedTime?: string;
  schedTz?: string;
  comboFreq?: string;
  comboTime?: string;
  comboCondition?: string;
  comboScope?: string;
};

const MACHINE_POLICY_DEFAULTS = {
  scheduling_mode: 'auto' as const,
  pool: 'default',
  is_local: false,
  max_concurrent_threads: null,
  allowed_agent_types: null,
  allowed_project_ids: null,
  priority: 0,
};

export const TEST_PROJECTS: Project[] = [
  {
    id: 'demo-proj-taskyard',
    name: 'Taskyard',
    repo_url: 'https://github.com/example/taskyard.git',
    default_branch: 'main',
    archived: false,
    archived_at: null,
    created_at: isoMinutesAgo(60 * 24 * 30),
    active_threads: 2,
  },
  {
    id: 'demo-proj-invoices',
    name: 'Invoice Parser',
    repo_url: 'https://github.com/example/invoice-tools.git',
    default_branch: 'develop',
    archived: false,
    archived_at: null,
    created_at: isoMinutesAgo(60 * 24 * 14),
    active_threads: 1,
  },
  {
    id: 'demo-proj-planning',
    name: 'Q3 Planning',
    repo_url: null,
    default_branch: 'main',
    archived: false,
    archived_at: null,
    created_at: isoMinutesAgo(60 * 24 * 3),
    active_threads: 0,
  },
  {
    id: 'demo-proj-legacy',
    name: 'Legacy Monolith',
    repo_url: 'https://github.com/example/legacy-app.git',
    default_branch: 'main',
    archived: true,
    archived_at: isoMinutesAgo(60 * 24 * 90),
    created_at: isoMinutesAgo(60 * 24 * 400),
    active_threads: 0,
  },
];

export const TEST_MACHINES: Array<
  Machine & { port_utilization?: { used: number; total: number; reserved?: number } }
> = [
  {
    ...MACHINE_POLICY_DEFAULTS,
    id: 'demo-mac-studio-01',
    name: 'mac-studio-01',
    is_local: true,
    pool: 'local',
    ip_address: '192.168.1.10',
    port_range_start: 5900,
    port_range_end: 5919,
    cpu_cores: 12,
    ram_gb: 64,
    gpu_info: null,
    status: 'online',
    last_heartbeat: isoMinutesAgo(1),
    cpu_percent: 75,
    ram_used_gb: 48,
    active_threads: 2,
    port_utilization: { used: 12, total: 20 },
  },
  {
    ...MACHINE_POLICY_DEFAULTS,
    id: 'demo-linux-box-02',
    name: 'linux-box-02',
    pool: 'homelab',
    scheduling_mode: 'auto',
    ip_address: '192.168.1.42',
    port_range_start: 5900,
    port_range_end: 5919,
    cpu_cores: 8,
    ram_gb: 32,
    gpu_info: 'RTX 4060',
    status: 'online',
    last_heartbeat: isoMinutesAgo(1),
    cpu_percent: 50,
    ram_used_gb: 24,
    active_threads: 2,
    port_utilization: { used: 8, total: 20, reserved: 2 },
  },
  {
    ...MACHINE_POLICY_DEFAULTS,
    id: 'demo-homelab-03',
    name: 'homelab-03',
    pool: 'homelab',
    scheduling_mode: 'manual_only',
    ip_address: '10.0.0.23',
    port_range_start: 5900,
    port_range_end: 5919,
    cpu_cores: 4,
    ram_gb: 16,
    gpu_info: null,
    status: 'online',
    last_heartbeat: isoMinutesAgo(4),
    cpu_percent: 25,
    ram_used_gb: 8,
    active_threads: 2,
    port_utilization: { used: 4, total: 20 },
  },
];

export const TEST_THREADS: Thread[] = [
  {
    id: 'demo-invoice-pdf-parser',
    project_id: 'invoices',
    project_name: 'Invoice Parser',
    machine_id: 'demo-mac-studio-01',
    machine_name: 'mac-studio-01',
    agent_type: 'codex',
    branch: 'invoice-pdf-parser',
    prompt: 'Extract line items from scanned PDFs and map them to schema v2.',
    status: 'paused',
    worktree_path: '/Users/dev/invoices',
    container_id: null,
    web_port: null,
    rustdesk_port: 21116,
    created_at: isoMinutesAgo(134),
    started_at: isoMinutesAgo(134),
    completed_at: null,
    closed_at: null,
  },
  {
    id: 'demo-taskyard-ui-wireframe',
    project_id: 'taskyard',
    project_name: 'Taskyard',
    machine_id: 'demo-linux-box-02',
    machine_name: 'linux-box-02',
    agent_type: 'cursor',
    branch: 'taskyard-ui-wireframe',
    prompt: 'Light theme, thin borders, no rounded corners. Capacity dock at the bottom, threads on the right.',
    status: 'paused',
    worktree_path: '/home/dev/taskyard',
    container_id: null,
    web_port: 8080,
    rustdesk_port: 21116,
    created_at: isoMinutesAgo(45),
    started_at: isoMinutesAgo(45),
    completed_at: null,
    closed_at: null,
  },
  {
    id: 'demo-fix-port-forward-leak',
    project_id: 'infra',
    project_name: 'Homelab Infra',
    machine_id: 'demo-homelab-03',
    machine_name: 'homelab-03',
    agent_type: 'codex',
    branch: 'fix-port-forward-leak',
    prompt: 'Clear stale port-forward on 21116 and retry kubectl forward.',
    status: 'error',
    worktree_path: '/home/dev/homelab',
    container_id: null,
    web_port: null,
    rustdesk_port: 21117,
    created_at: isoMinutesAgo(20),
    started_at: isoMinutesAgo(20),
    completed_at: null,
    closed_at: null,
  },
  {
    id: 'demo-openapi-client-gen',
    project_id: 'taskyard',
    project_name: 'Taskyard',
    machine_id: 'demo-linux-box-02',
    machine_name: 'linux-box-02',
    agent_type: 'cursor',
    branch: 'openapi-client-gen',
    prompt: 'Generate typed TypeScript client from taskyard.v1.yaml.',
    status: 'paused',
    worktree_path: '/home/dev/taskyard',
    container_id: null,
    web_port: null,
    rustdesk_port: null,
    created_at: isoMinutesAgo(65),
    started_at: isoMinutesAgo(65),
    completed_at: null,
    closed_at: null,
  },
  {
    id: 'demo-migrate-auth-to-clerk',
    project_id: 'taskyard',
    project_name: 'Taskyard',
    machine_id: 'demo-mac-studio-01',
    machine_name: 'mac-studio-01',
    agent_type: 'kimi',
    branch: 'migrate-auth-to-clerk',
    prompt: 'Map legacy session cookies to Clerk JWT middleware.',
    status: 'completed',
    worktree_path: '/Users/dev/taskyard',
    container_id: null,
    web_port: null,
    rustdesk_port: null,
    created_at: isoMinutesAgo(400),
    started_at: isoMinutesAgo(400),
    completed_at: isoMinutesAgo(20),
    closed_at: null,
  },
  {
    id: 'demo-readme-refresh',
    project_id: 'taskyard',
    project_name: 'Taskyard',
    machine_id: 'demo-homelab-03',
    machine_name: 'homelab-03',
    agent_type: 'kimi',
    branch: 'readme-refresh',
    prompt: 'Update README with setup steps and capacity dock layout notes.',
    status: 'completed',
    worktree_path: '/home/dev/taskyard',
    container_id: null,
    web_port: null,
    rustdesk_port: null,
    created_at: isoMinutesAgo(30),
    started_at: isoMinutesAgo(30),
    completed_at: isoMinutesAgo(8),
    closed_at: null,
  },
];

export const TEST_CHAT: Record<string, TestChatFixture> = {
  'invoice-pdf-parser': {
    waiting: true,
    waitingPrompt: '14 rows scored below 0.85 confidence — approve corrections or skip review?',
    messages: [
      { role: 'system', text: 'Session started · workspace /Users/dev/invoices' },
      {
        role: 'assistant',
        text: "I'll extract line items from the scanned PDFs and map them to schema v2. Starting with inv-1042.pdf.",
      },
      { role: 'system', text: 'Wrote parsers/pdf_table.py · 14 rows parsed' },
      {
        role: 'assistant',
        text: "Parsed 14 rows at 0.91 average confidence. Three amount fields look misaligned — I've queued them for your review before we batch the rest.",
      },
    ],
  },
  'taskyard-ui-wireframe': {
    waiting: true,
    waitingPrompt:
      'Port 21116 is forwarded. Open RustDesk to review the dashboard layout, or reply to continue wireframing.',
    messages: [
      { role: 'system', text: 'Session started · workspace /home/dev/taskyard' },
      {
        role: 'user',
        text: 'Light theme, thin borders, no rounded corners. Capacity dock at the bottom, threads on the right.',
      },
      {
        role: 'assistant',
        text: "Got it — I'll bind a high-contrast token set, square badges, and move machine capacity into a bottom dock with per-machine thread buttons.",
      },
      { role: 'system', text: 'Updated css/taskyard.css and screens/dashboard.html' },
      {
        role: 'assistant',
        text: 'Dashboard shell is in place: header with logo, center stream, right rail, bottom tiles. Thread selection syncs between the rail and machine buttons.',
      },
      { role: 'system', text: 'Port 21116 was in use — cleared and re-forwarded localhost:21116 → worker:21116' },
      {
        role: 'assistant',
        text: 'Preview is ready on the worker. Want me to keep iterating on the chat layout, or do you want to check the live preview first?',
      },
    ],
  },
  'fix-port-forward-leak': {
    waiting: false,
    messages: [
      { role: 'system', text: 'Session started on homelab-03' },
      { role: 'assistant', text: 'Running kubectl port-forward for the agent service on 21116…' },
      { role: 'system', text: 'Error · bind: address already in use on 0.0.0.0:21116' },
      {
        role: 'assistant',
        text: 'Something is still listening on 21116 (pid 8842). I can kill the stale forward if you want me to retry, or you can free the port manually.',
      },
    ],
  },
  'openapi-client-gen': {
    waiting: true,
    waitingPrompt:
      'taskyard.v1.yaml defines two auth schemes — should the client send Bearer only, or support API keys too?',
    messages: [
      { role: 'system', text: 'Session started · openapi/taskyard.v1.yaml' },
      {
        role: 'assistant',
        text: 'Generating a typed TypeScript client from the OpenAPI spec. Base types are in clients/ts/schema.d.ts.',
      },
      { role: 'system', text: 'Wrote clients/ts/index.ts' },
      {
        role: 'assistant',
        text: 'The spec lists both Bearer JWT and x-api-key. Which auth path should the default client factory use?',
      },
    ],
  },
  'migrate-auth-to-clerk': {
    waiting: false,
    messages: [
      { role: 'system', text: 'Session completed · 06:00:11' },
      {
        role: 'assistant',
        text: 'Mapped legacy session cookies to Clerk JWT middleware and added migration notes in docs/auth-migration.md.',
      },
      { role: 'system', text: 'npm run build · succeeded' },
      { role: 'assistant', text: 'Build passed. Middleware is ready for staging — no open questions from my side.' },
    ],
  },
  'readme-refresh': {
    waiting: false,
    messages: [
      { role: 'system', text: 'Session completed · 09:10:44' },
      {
        role: 'assistant',
        text: 'Updated README with setup steps, env vars, and a short section on the capacity dock + thread rail layout.',
      },
    ],
  },
};

export const TEST_THREAD_EVENTS: Record<string, ThreadEvent[]> = {
  'demo-taskyard-ui-wireframe': [
    {
      id: 1,
      thread_id: 'demo-taskyard-ui-wireframe',
      event_type: 'system',
      payload: { type: 'system', event: 'session started', status: 'running' },
      timestamp: isoMinutesAgo(38),
    },
    {
      id: 2,
      thread_id: 'demo-taskyard-ui-wireframe',
      event_type: 'thought',
      payload: {
        type: 'thought',
        content: 'Planning dashboard grid: thread cards left, capacity panel right on ≥1024px.',
      },
      timestamp: isoMinutesAgo(37),
    },
    {
      id: 3,
      thread_id: 'demo-taskyard-ui-wireframe',
      event_type: 'file_write',
      payload: { type: 'file_write', path: 'screens/dashboard.html', size_bytes: 4200 },
      timestamp: isoMinutesAgo(36),
    },
    {
      id: 4,
      thread_id: 'demo-taskyard-ui-wireframe',
      event_type: 'error',
      payload: { type: 'error', message: 'port 21116 already bound on linux-box-02 — retrying forward…' },
      timestamp: isoMinutesAgo(35),
    },
  ],
};

export const TEST_OVERVIEW_NEEDS_YOU: OverviewItem[] = [
  {
    id: 'ty15',
    kind: 'Task · TY-15',
    title: 'RustDesk preview gate before visual polish',
    meta: 'Agent forwarded port 21116 — open RustDesk or reply to continue wireframing.',
    badgeClass: 'badge-waiting',
    badgeLabel: 'Waiting for user',
    facts: [
      { dt: 'Project', dd: 'Taskyard' },
      { dt: 'Agent', dd: 'Kimi · linux-box-02' },
      { dt: 'Waiting since', dd: 'Today 09:41' },
      { dt: 'Preview', dd: 'localhost:21116 → wireframe session' },
    ],
    note: 'Agent paused after forwarding RustDesk — review the live UI before approving the next polish pass.',
    actions: [
      { label: 'Open task', href: '/dashboard', variant: 'primary' },
      { label: 'Open RustDesk preview', variant: 'ghost' },
      { label: 'Reply on task', variant: 'ghost' },
    ],
  },
  {
    id: 'wireframe',
    kind: 'Thread · taskyard-ui-wireframe',
    title: 'Dashboard layout review',
    meta: 'Port 21116 is forwarded on linux-box-02 — RustDesk in or reply to continue.',
    badgeClass: 'badge-waiting',
    badgeLabel: 'Waiting',
    facts: [
      { dt: 'Machine', dd: 'linux-box-02' },
      { dt: 'Agent', dd: 'Cursor' },
      { dt: 'Forward', dd: '21116 → session desktop' },
    ],
    note: 'Thread is idle until you inspect the wireframe in RustDesk or send layout feedback in the thread stream.',
    actions: [
      { label: 'Open thread', href: '/threads/demo-taskyard-ui-wireframe', variant: 'primary' },
      { label: 'Open RustDesk', variant: 'ghost' },
      { label: 'Reply in thread', variant: 'ghost' },
    ],
  },
  {
    id: 'port-leak',
    kind: 'Thread · fix-port-forward-leak',
    title: 'Port forward not released after thread exit',
    meta: 'homelab-03 · slot 5907 still bound — kill stale forward or restart worker agent.',
    badgeClass: 'badge-error',
    badgeLabel: 'Error',
    facts: [
      { dt: 'Machine', dd: 'homelab-03' },
      { dt: 'Stale slot', dd: '5907' },
      { dt: 'Thread exited', dd: '12m ago' },
    ],
    note: 'Worker did not tear down the forward — new threads may fail to bind preview ports until this is cleared.',
    actions: [
      { label: 'Open thread', href: '/threads/demo-fix-port-forward-leak', variant: 'primary' },
      { label: 'Kill stale forward', variant: 'danger' },
      { label: 'Restart worker on homelab-03', variant: 'ghost' },
    ],
  },
];

export const TEST_OVERVIEW_FINISHED: OverviewItem[] = [
  {
    id: 'clerk',
    kind: 'Thread · migrate-auth-to-clerk',
    title: 'Clerk migration PR merged',
    meta: 'Kimi on mac-studio-01 · finished 6h ago · 3 tasks created from summary.',
    badgeClass: 'badge-completed',
    badgeLabel: 'Done',
    facts: [
      { dt: 'Finished', dd: '6h ago' },
      { dt: 'Tasks spawned', dd: 'TY-20, TY-21, TY-22' },
    ],
    note: 'Follow-up tasks are in Backlog — review if you want any moved to Ready for agent.',
    actions: [
      { label: 'Open thread', href: '/dashboard', variant: 'primary' },
      { label: 'Dismiss from overview', variant: 'ghost' },
    ],
  },
];

export const TEST_AUTO_RULES: TestAutoRule[] = [
  {
    id: 'pr-review',
    name: 'PR review on open',
    enabled: true,
    trigger: 'event',
    lastRun: 'Today 2:14 PM · 1 task',
    taskTitle: 'Review PR — {{repo}}/{{number}}',
    taskDesc: 'Read the diff, leave inline comments on risky changes, and summarize blockers.',
    project: 'taskyard-ui',
    tags: ['review', 'github'],
    eventSource: 'github',
    eventType: 'pr.opened',
    eventRepo: 'acme/*',
  },
  {
    id: 'friday-standup',
    name: 'Friday standup prep',
    enabled: true,
    trigger: 'schedule',
    lastRun: 'Fri 6:00 PM · 1 task',
    taskTitle: 'Weekly standup notes',
    taskDesc: 'Summarize merged PRs, open blockers, and capacity for next week.',
    project: 'taskyard-ui',
    tags: ['standup'],
    schedFreq: 'weekly',
    schedDay: 'fri',
    schedTime: '18:00',
    schedTz: 'America/Los_Angeles',
  },
  {
    id: 'daily-digest',
    name: 'Daily commit digest',
    enabled: false,
    trigger: 'combined',
    lastRun: 'Yesterday 6:00 PM · 2 tasks (homelab-infra, taskyard-ui)',
    taskTitle: 'Digest — {{project}} commits',
    taskDesc: 'List commits since last run with author and one-line summary.',
    project: 'homelab-infra',
    tags: ['digest', 'auto'],
    comboFreq: 'daily',
    comboTime: '18:00',
    comboCondition: 'commits',
    comboScope: 'each-project',
  },
];

export function getTestThreadDetail(id: string): ThreadDetail | null {
  const thread = TEST_THREADS.find((t) => t.id === id);
  if (!thread) return null;
  return {
    ...thread,
    events: TEST_THREAD_EVENTS[id] ?? [],
  };
}

export function getTestChatForThread(thread: Thread): TestChatFixture | null {
  const key = thread.branch || thread.id.replace(/^demo-/, '');
  return TEST_CHAT[key] ?? null;
}

export const DEFAULT_TEST_THREAD_ID = 'demo-taskyard-ui-wireframe';
