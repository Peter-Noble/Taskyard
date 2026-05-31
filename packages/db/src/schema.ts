import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  repoUrl: text('repo_url').notNull(),
  defaultBranch: text('default_branch').default('main'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const threads = sqliteTable('threads', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
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

export const vault = sqliteTable('vault', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  agentType: text('agent_type').notNull(),
  keyName: text('key_name').notNull(),
  keyValue: text('key_value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
