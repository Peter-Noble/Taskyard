import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function credentialServerUrl(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return undefined;
  if (url.username || url.password || url.search || url.hash) return undefined;
  return url.href.replace(/\/+$/, '');
}

function credentialPath(server: string): string {
  const name = createHash('sha256').update(server).digest('hex');
  return path.join(os.homedir(), '.taskyard', 'credentials', `${name}.json`);
}

export function readCliToken(serverUrl: string): string | undefined {
  const server = credentialServerUrl(serverUrl);
  if (!server) return undefined;
  try {
    const value = JSON.parse(fs.readFileSync(credentialPath(server), 'utf8')) as { token?: unknown } | null;
    if (typeof value?.token === 'string') return value.token;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  return undefined;
}

export function saveCliToken(server: string, token: string): void {
  const file = credentialPath(server);
  const temporary = `${file}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(temporary, `${JSON.stringify({ token })}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function clearCliToken(server: string, token: string): void {
  if (readCliToken(server) === token) fs.rmSync(credentialPath(server), { force: true });
}
