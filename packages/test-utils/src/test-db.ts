import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDb, findRepoRoot, machines, threads, type TaskyardDb } from '@taskyard/db';
export type TestDbContext = {
  db: TaskyardDb;
  sqlite: ReturnType<typeof createDb>['sqlite'];
  path: string;
  cleanup: () => void;
};

function pushSchema(dbPath: string): void {
  const repoRoot = findRepoRoot();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  execSync('pnpm exec drizzle-kit push', {
    cwd: path.join(repoRoot, 'packages', 'db'),
    env: {
      ...process.env,
      TASKYARD_DB_PATH: dbPath,
      TASKYARD_REPO_ROOT: repoRoot,
    },
    stdio: 'pipe',
  });
}

function initSchema(dbPath: string): void {
  const template = process.env.TASKYARD_TEST_SCHEMA_TEMPLATE;
  if (template && fs.existsSync(template)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.copyFileSync(template, dbPath);
    return;
  }
  pushSchema(dbPath);
}

export function createTestDb(): TestDbContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskyard-test-'));
  const dbPath = path.join(dir, 'test.db');

  initSchema(dbPath);

  const { db, sqlite } = createDb(dbPath);

  return {
    db,
    sqlite,
    path: dbPath,
    cleanup() {
      sqlite.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function seedOnlineMachine(
  db: TaskyardDb,
  overrides: Partial<typeof machines.$inferInsert> = {},
): typeof machines.$inferSelect {
  const row = {
    id: overrides.id ?? 'machine-test-1',
    name: overrides.name ?? 'test-worker',
    ipAddress: overrides.ipAddress ?? '127.0.0.1',
    portRangeStart: overrides.portRangeStart ?? 30000,
    portRangeEnd: overrides.portRangeEnd ?? 30010,
    cpuCores: overrides.cpuCores ?? 8,
    ramGb: overrides.ramGb ?? 32,
    gpuInfo: overrides.gpuInfo ?? null,
    status: overrides.status ?? 'online',
    cpuPercent: overrides.cpuPercent ?? 10,
    ramUsedGb: overrides.ramUsedGb ?? 4,
    lastHeartbeat: overrides.lastHeartbeat ?? new Date(),
    schedulingMode: overrides.schedulingMode ?? 'auto',
    pool: overrides.pool ?? 'default',
    isLocal: overrides.isLocal ?? false,
    maxConcurrentThreads: overrides.maxConcurrentThreads ?? null,
    allowedAgentTypes: overrides.allowedAgentTypes ?? null,
    allowedProjectIds: overrides.allowedProjectIds ?? null,
    priority: overrides.priority ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
  };

  db.insert(machines).values(row).run();
  return row as typeof machines.$inferSelect;
}

export function seedThread(
  db: TaskyardDb,
  id: string,
  machineId: string,
  overrides: Partial<typeof threads.$inferInsert> = {},
): typeof threads.$inferSelect {
  const row = {
    id,
    machineId,
    projectId: overrides.projectId ?? null,
    agentType: overrides.agentType ?? 'stub',
    branch: overrides.branch ?? 'main',
    prompt: overrides.prompt ?? 'test prompt',
    status: overrides.status ?? 'pending',
    worktreePath: overrides.worktreePath ?? null,
    containerId: overrides.containerId ?? null,
    webPort: overrides.webPort ?? null,
    rustdeskPort: overrides.rustdeskPort ?? null,
    taskId: overrides.taskId ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    closedAt: overrides.closedAt ?? null,
  };

  db.insert(threads).values(row).run();
  return row as typeof threads.$inferSelect;
}
