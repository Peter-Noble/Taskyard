/**
 * Copy the live DB (data/taskyard.db) onto the host-dev sandbox
 * (data/taskyard-dev.db) using SQLite's online backup API.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const livePath = path.join(root, 'data', 'taskyard.db');
const sandboxPath = path.join(root, 'data', 'taskyard-dev.db');

if (!fs.existsSync(livePath)) {
  console.warn(`==> no live DB at ${livePath}; leaving sandbox alone`);
  process.exit(0);
}

for (const p of [sandboxPath, `${sandboxPath}-wal`, `${sandboxPath}-shm`]) {
  fs.rmSync(p, { force: true });
}

const live = new Database(livePath, { readonly: true, fileMustExist: true });
try {
  await live.backup(sandboxPath);
  console.log(`==> sandbox refreshed from live → ${sandboxPath}`);
} finally {
  live.close();
}
