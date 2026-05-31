import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertSafeTestEnv } from '@taskyard/test-utils';

process.env.NODE_ENV = 'test';

if (!process.env.TASKYARD_DB_PATH) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskyard-vitest-'));
  process.env.TASKYARD_DB_PATH = path.join(dir, 'global.db');
}

assertSafeTestEnv();
