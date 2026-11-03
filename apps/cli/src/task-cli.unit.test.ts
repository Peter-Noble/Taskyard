import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readProjectFile } from './project-file.js';
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
