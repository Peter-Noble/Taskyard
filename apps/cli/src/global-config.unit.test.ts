import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getGlobalServerUrl, writeGlobalConfig } from './global-config.js';
import { resolveProjectContext } from './project-file.js';

describe('global config server URL', () => {
  const prevHome = process.env.HOME;
  const prevServer = process.env.TASKYARD_SERVER_URL;
  const prevWorkspace = process.env.TASKYARD_WORKSPACE;
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'taskyard-cfg-'));
    process.env.HOME = tmpHome;
    delete process.env.TASKYARD_SERVER_URL;
    delete process.env.TASKYARD_WORKSPACE;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevServer === undefined) delete process.env.TASKYARD_SERVER_URL;
    else process.env.TASKYARD_SERVER_URL = prevServer;
    if (prevWorkspace === undefined) delete process.env.TASKYARD_WORKSPACE;
    else process.env.TASKYARD_WORKSPACE = prevWorkspace;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('reads server_url from ~/.config/taskyard/config.json', () => {
    const emptyWs = fs.mkdtempSync(path.join(tmpHome, 'ws-'));
    process.env.TASKYARD_WORKSPACE = emptyWs;
    const prevCwd = process.cwd();
    process.chdir(emptyWs);
    try {
      writeGlobalConfig({ server_url: 'https://example.test' });
      expect(getGlobalServerUrl()).toBe('https://example.test');
      const ctx = resolveProjectContext();
      expect(ctx.serverUrl).toBe('https://example.test');
    } finally {
      process.chdir(prevCwd);
    }
  });

  it('prefers TASKYARD_SERVER_URL over global config', () => {
    const emptyWs = fs.mkdtempSync(path.join(tmpHome, 'ws-'));
    process.env.TASKYARD_WORKSPACE = emptyWs;
    writeGlobalConfig({ server_url: 'https://from-config.test' });
    process.env.TASKYARD_SERVER_URL = 'https://from-env.test';
    expect(resolveProjectContext().serverUrl).toBe('https://from-env.test');
  });

  it('prefers project.json server_url over global config', () => {
    const ws = fs.mkdtempSync(path.join(tmpHome, 'proj-'));
    fs.mkdirSync(path.join(ws, '.taskyard'));
    fs.writeFileSync(
      path.join(ws, '.taskyard', 'project.json'),
      `${JSON.stringify({ project_id: 'p1', server_url: 'https://from-project.test' }, null, 2)}\n`,
    );
    process.env.TASKYARD_WORKSPACE = ws;
    writeGlobalConfig({ server_url: 'https://from-config.test' });
    expect(resolveProjectContext().serverUrl).toBe('https://from-project.test');
  });
});
