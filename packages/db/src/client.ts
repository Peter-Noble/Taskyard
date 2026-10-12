import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type TaskyardDb = BetterSQLite3Database<typeof schema>;

/** Live / Docker default. */
export const PRODUCTION_DB_BASENAME = 'taskyard.db';
/** Host-side `next dev` default — separate file so live stays up. */
export const SANDBOX_DB_BASENAME = 'taskyard-dev.db';

export function findRepoRoot(start = process.cwd()): string {
  if (process.env.TASKYARD_REPO_ROOT) {
    return path.resolve(process.env.TASKYARD_REPO_ROOT);
  }
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export function productionDbPath(root = findRepoRoot()): string {
  return path.join(root, 'data', PRODUCTION_DB_BASENAME);
}

export function sandboxDbPath(root = findRepoRoot()): string {
  return path.join(root, 'data', SANDBOX_DB_BASENAME);
}

export function isSandboxDbPath(dbPath: string): boolean {
  const normalized = path.resolve(dbPath);
  return (
    normalized.endsWith(`${path.sep}data${path.sep}${SANDBOX_DB_BASENAME}`) ||
    dbPath.endsWith(`data/${SANDBOX_DB_BASENAME}`)
  );
}

/** True when the UI should warn that this session is not live production data. */
export function shouldShowSandboxChrome(dbPath = resolveDbPath()): boolean {
  // next dev always frames the page; production only when on the sandbox file.
  if (process.env.NODE_ENV === 'development') return true;
  return isSandboxDbPath(dbPath);
}

function defaultDbPath(): string {
  // NODE_ENV=development → data/taskyard-dev.db; otherwise data/taskyard.db.
  if (process.env.NODE_ENV === 'development') {
    return sandboxDbPath();
  }
  return productionDbPath();
}

export function resolveDbPath(explicitPath?: string): string {
  if (explicitPath) return explicitPath;
  if (process.env.TASKYARD_DB_PATH) return process.env.TASKYARD_DB_PATH;
  return defaultDbPath();
}

export function createDb(dbPath?: string): {
  db: TaskyardDb;
  sqlite: Database.Database;
  path: string;
} {
  const resolved = resolveDbPath(dbPath);
  if (resolved !== ':memory:') {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }

  const sqlite = new Database(resolved);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  return { db, sqlite, path: resolved };
}
