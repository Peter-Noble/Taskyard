import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default function globalSetup() {
  const schema = fs.readFileSync(path.join(root, 'packages', 'db', 'src', 'schema.ts'));
  const hash = createHash('sha256').update(schema).digest('hex').slice(0, 12);
  const templatePath = path.join(os.tmpdir(), `taskyard-test-schema-${hash}.db`);
  if (!fs.existsSync(templatePath)) {
    fs.mkdirSync(path.dirname(templatePath), { recursive: true });
    execSync('pnpm exec drizzle-kit push', {
      cwd: path.join(root, 'packages', 'db'),
      env: {
        ...process.env,
        TASKYARD_DB_PATH: templatePath,
        TASKYARD_REPO_ROOT: root,
      },
      stdio: 'pipe',
    });
  }
  process.env.TASKYARD_TEST_SCHEMA_TEMPLATE = templatePath;
}
