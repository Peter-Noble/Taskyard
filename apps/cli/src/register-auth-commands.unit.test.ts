import { Command } from 'commander';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCliToken } from './credentials.js';
import { registerAuthCommands } from './register-auth-commands.js';
import { apiFetch } from './task-cli.js';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => undefined) }));

let profile: string;
const server = 'https://taskyard.example';

function run(...args: string[]) {
  const program = new Command();
  registerAuthCommands(program);
  return program.parseAsync([...args, '--server', server], { from: 'user' });
}

beforeEach(() => {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'taskyard-cli-profile-'));
  vi.spyOn(os, 'homedir').mockReturnValue(profile);
  vi.stubEnv('TASKYARD_SESSION_TOKEN', undefined);
  vi.stubEnv('TASKYARD_THREAD_ID', undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(profile, { recursive: true, force: true });
});

describe('browser-approved CLI credentials', () => {
  it('prints only the short code, scopes the saved token, and revokes it on logout', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ code: 'ABCDE-FG234', secret: 'poll-secret', expires_in: 600, interval: 5 }))
      .mockResolvedValueOnce(Response.json({ status: 'pending' }))
      .mockResolvedValueOnce(Response.json({ status: 'approved', token: 'session-token', username: 'peter' }))
      .mockImplementation(async () => Response.json({ ok: true }));

    await run('login');
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining(`${server}/activate and enter code ABCDE-FG234`));
    expect(JSON.stringify([stdout.mock.calls, stderr.mock.calls])).not.toMatch(/poll-secret|session-token/);
    expect(readCliToken(`${server}/`)).toBe('session-token');

    await apiFetch('/api/tasks', undefined, server);
    expect(fetch.mock.lastCall?.[1]?.headers).toMatchObject({ Authorization: 'Bearer session-token' });
    await apiFetch('/api/tasks', undefined, 'https://other.example');
    expect(fetch.mock.lastCall?.[1]?.headers).not.toHaveProperty('Authorization');
    await apiFetch('/api/tasks', undefined, 'http://taskyard.example');
    expect(fetch.mock.lastCall?.[1]?.headers).not.toHaveProperty('Authorization');
    vi.stubEnv('TASKYARD_THREAD_ID', 'agent-run');
    await apiFetch('/api/tasks', undefined, server);
    expect(fetch.mock.lastCall?.[1]?.headers).not.toHaveProperty('Authorization');

    await run('logout');
    expect(fetch).toHaveBeenLastCalledWith(`${server}/api/auth/logout`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer session-token' }),
    }));
    expect(readCliToken(server)).toBeUndefined();
  });
});
