import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { findRepoRoot } from '@taskyard/db';

let loaded = false;

/** Load `.env` then `.env.local` from the repo root (no-op if already loaded). */
export function loadTaskyardEnv(): void {
  if (loaded) return;
  const root = findRepoRoot();
  for (const name of ['.env', '.env.local']) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) {
      config({ path: file, override: false });
    }
  }
  loaded = true;
}
