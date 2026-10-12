import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

const root = findRepoRoot();
const dbPath =
  process.env.TASKYARD_DB_PATH ??
  path.join(
    root,
    'data',
    process.env.NODE_ENV === 'development' ? 'taskyard-dev.db' : 'taskyard.db',
  );
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export default defineConfig({
  schema: './src/schema.ts',
  out: './src/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
});
