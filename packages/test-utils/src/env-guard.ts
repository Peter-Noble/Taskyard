import os from 'node:os';
import path from 'node:path';

const DEV_DB_NAME = `${path.sep}data${path.sep}taskyard.db`;

export function isDevDbPath(dbPath: string): boolean {
  const normalized = path.resolve(dbPath);
  return normalized.endsWith(DEV_DB_NAME) || dbPath.endsWith('data/taskyard.db');
}

export function isSafeTestDbPath(dbPath: string): boolean {
  if (dbPath === ':memory:') return true;
  const resolved = path.resolve(dbPath);
  const tmpRoot = path.resolve(os.tmpdir());
  return resolved.startsWith(tmpRoot) && !isDevDbPath(resolved);
}

export function assertSafeTestEnv(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Tests must run with NODE_ENV=test');
  }

  const dbPath = process.env.TASKYARD_DB_PATH;
  if (!dbPath) {
    throw new Error('TASKYARD_DB_PATH must be set for tests');
  }

  if (isDevDbPath(dbPath)) {
    throw new Error(`Refusing to run tests against dev database: ${dbPath}`);
  }

  if (!isSafeTestDbPath(dbPath)) {
    throw new Error(
      `TASKYARD_DB_PATH must be :memory: or under the system temp directory: ${dbPath}`,
    );
  }
}
