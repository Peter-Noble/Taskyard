import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type TaskyardDb = BetterSQLite3Database<typeof schema>;

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

function defaultDbPath(): string {
  return path.join(findRepoRoot(), 'data', 'taskyard.db');
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
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const sqlite = new Database(resolved);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  return { db, sqlite, path: resolved };
}
