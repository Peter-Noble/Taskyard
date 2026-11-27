import { Command } from 'commander';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readProjectFile } from './project-file.js';
import { registerTaskCommands } from './register-task-commands.js';
import { cmdSetup, DEFAULT_SERVER_URL } from './task-cli.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('taskyard setup', () => {
  it('writes the hosted server URL by default', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-setup-'));
    const previousServerUrl = process.env.TASKYARD_SERVER_URL;
    delete process.env.TASKYARD_SERVER_URL;
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ decisions: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      await cmdSetup({ project: 'proj-1', dir: root }, false);

      expect(readProjectFile(root)?.server_url).toBe(DEFAULT_SERVER_URL);
      expect(fetchMock).toHaveBeenCalledWith(
        `${DEFAULT_SERVER_URL}/api/decisions?project_id=proj-1`,
        expect.any(Object),
      );
    } finally {
      if (previousServerUrl === undefined) delete process.env.TASKYARD_SERVER_URL;
      else process.env.TASKYARD_SERVER_URL = previousServerUrl;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('task labels', () => {
  function run(...args: string[]) {
    const program = new Command().exitOverride().configureOutput({ writeErr: () => {} });
    registerTaskCommands(program);
    return program.parseAsync(['task', ...args], { from: 'user' });
  }

  it('sends type, priority, and category when creating and updating a task', async () => {
    const task = { short_id: 'EX-1', task_type: 'bug', priority: 'high', category: 'CLI auth' };
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ task, decisions: [] }));
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await run('create', '--project', 'proj-1', '--title', 'Login issue',
      '--type', 'bug', '--priority', 'high', '--category', 'CLI auth', '--pretty');
    const create = fetch.mock.calls[0]?.[1];
    expect(create?.method).toBe('POST');
    expect(JSON.parse(create?.body as string)).toEqual({
      project_id: 'proj-1', title: 'Login issue', task_type: 'bug', priority: 'high', category: 'CLI auth',
    });
    expect(output.mock.calls[0]?.[0]).toContain('type: bug\npriority: high\ncategory: CLI auth');

    fetch.mockClear();
    await run('update', 'EX-1', '--type', 'design', '--priority', 'low', '--category', 'Terminal');
    const patch = fetch.mock.calls[0]?.[1];
    expect(patch?.method).toBe('PATCH');
    expect(JSON.parse(patch?.body as string)).toEqual({
      actor: expect.any(String), task_type: 'design', priority: 'low', category: 'Terminal',
    });

    fetch.mockClear();
    await run('update', 'EX-1', '--clear-category');
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({
      actor: expect.any(String), category: null,
    });
  });

  it('rejects invalid choices and conflicting category flags before calling the server', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(run('create', '--title', 'Login issue', '--type', 'defect')).rejects.toThrow(/Allowed choices/);
    await expect(run('update', 'EX-1', '--priority', 'urgent')).rejects.toThrow(/Allowed choices/);
    await expect(run('update', 'EX-1', '--category', 'Terminal', '--clear-category')).rejects.toThrow(/cannot be used with/);
    expect(fetch).not.toHaveBeenCalled();
  });
});
