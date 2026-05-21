import { createDb, type TaskyardDb } from '@taskyard/db';

let cached: { db: TaskyardDb; path: string } | null = null;

export function getDb() {
  if (!cached) {
    cached = createDb();
  }
  return cached.db;
}
