import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ipAddress: text('ip_address'),
  portRangeStart: integer('port_range_start').notNull(),
  portRangeEnd: integer('port_range_end').notNull(),
  cpuCores: integer('cpu_cores'),
  ramGb: integer('ram_gb'),
  gpuInfo: text('gpu_info'),
  status: text('status', { enum: ['online', 'offline', 'busy'] }).default('offline'),
  cpuPercent: real('cpu_percent'),
  ramUsedGb: real('ram_used_gb'),
  lastHeartbeat: integer('last_heartbeat', { mode: 'timestamp' }),
  schedulingMode: text('scheduling_mode', {
    enum: ['auto', 'manual_only', 'disabled'],
  }).default('auto'),
  pool: text('pool').default('default'),
  isLocal: integer('is_local', { mode: 'boolean' }).default(false),
  maxConcurrentThreads: integer('max_concurrent_threads'),
  allowedAgentTypes: text('allowed_agent_types'),
  allowedProjectIds: text('allowed_project_ids'),
  priority: integer('priority').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  repoUrl: text('repo_url'),
  defaultBranch: text('default_branch').default('main'),
  archived: integer('archived', { mode: 'boolean' }).default(false),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
  taskPrefix: text('task_prefix'),
  nextTaskNumber: integer('next_task_number').notNull().default(0),
  nextDecisionNumber: integer('next_decision_number').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    shortId: text('short_id').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    parentId: text('parent_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', {
      enum: ['backlog', 'ready', 'in_progress', 'review', 'merge', 'waiting', 'completed', 'cancelled'],
    })
      .notNull()
      .default('ready'),
    assignee: text('assignee'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('tasks_short_id_unique').on(table.shortId)],
);

export const taskDependencies = sqliteTable(
  'task_dependencies',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    dependsOnTaskId: text('depends_on_task_id')
      .notNull()
      .references(() => tasks.id),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.dependsOnTaskId] })],
);

export const taskDecisions = sqliteTable(
  'task_decisions',
  {
    id: text('id').primaryKey(),
    shortId: text('short_id').notNull(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    choice: text('choice').notNull(),
    why: text('why').notNull(),
    status: text('status', { enum: ['accepted', 'rejected'] }).notNull().default('accepted'),
    exportedAt: integer('exported_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('task_decisions_project_short').on(table.projectId, table.shortId)],
);

export const taskActivity = sqliteTable('task_activity', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id),
  kind: text('kind', { enum: ['status', 'comment', 'change'] }).notNull(),
  actor: text('actor').notNull(),
  payload: text('payload').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  taskId: text('task_id').references(() => tasks.id),
  machineId: text('machine_id').references(() => machines.id),
  agentType: text('agent_type').notNull(),
  branch: text('branch').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status', {
    enum: ['pending', 'spawning', 'running', 'paused', 'completed', 'error', 'closed'],
  }).default('pending'),
  worktreePath: text('worktree_path'),
  containerId: text('container_id'),
  webPort: integer('web_port'),
  rustdeskPort: integer('rustdesk_port'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
});

export const events = sqliteTable('events', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  threadId: text('thread_id').references(() => threads.id),
  eventType: text('event_type').notNull(),
  payload: text('payload').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const portAllocations = sqliteTable('port_allocations', {
  port: integer('port').primaryKey(),
  machineId: text('machine_id').references(() => machines.id),
  threadId: text('thread_id').references(() => threads.id),
  purpose: text('purpose', { enum: ['web', 'rustdesk'] }),
  allocatedAt: integer('allocated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  personId: text('person_id')
    .notNull()
    .references(() => people.id),
  tokenHash: text('token_hash').notNull().unique(),
  kind: text('kind', { enum: ['web', 'cli'] }).notNull().default('web'),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const collections = sqliteTable(
  'collections',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => people.id),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex('collections_person_name').on(table.personId, table.name)],
);

export const collectionProjects = sqliteTable(
  'collection_projects',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.projectId] })],
);

export const vault = sqliteTable('vault', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  agentType: text('agent_type').notNull(),
  keyName: text('key_name').notNull(),
  keyValue: text('key_value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
