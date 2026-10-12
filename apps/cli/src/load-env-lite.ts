import fs from 'node:fs';
import path from 'node:path';

let loaded = false;

function applyEnvFile(file: string): void {
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/**
 * Load `.env` / `.env.local` from cwd (and parents) without pulling `@taskyard/db`.
 * Standalone installs primarily use ~/.config/taskyard/config.json and env vars.
 */
export function loadEnvLite(): void {
  if (loaded) return;
  loaded = true;
  let dir = process.cwd();
  for (;;) {
    for (const name of ['.env', '.env.local']) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) applyEnvFile(file);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
