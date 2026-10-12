import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isSandboxDbPath,
  productionDbPath,
  resolveDbPath,
  sandboxDbPath,
  shouldShowSandboxChrome,
} from './client.js';

describe('resolveDbPath', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('prefers an explicit path', () => {
    process.env.TASKYARD_DB_PATH = '/ignored.db';
    process.env.NODE_ENV = 'development';
    expect(resolveDbPath('/explicit.db')).toBe('/explicit.db');
  });

  it('prefers TASKYARD_DB_PATH over NODE_ENV defaults', () => {
    process.env.NODE_ENV = 'development';
    process.env.TASKYARD_DB_PATH = '/custom.db';
    expect(resolveDbPath()).toBe('/custom.db');
  });

  it('uses the sandbox file under NODE_ENV=development', () => {
    delete process.env.TASKYARD_DB_PATH;
    process.env.NODE_ENV = 'development';
    process.env.TASKYARD_REPO_ROOT = '/repo';
    expect(resolveDbPath()).toBe(path.join('/repo', 'data', 'taskyard-dev.db'));
  });

  it('uses the production file outside development', () => {
    delete process.env.TASKYARD_DB_PATH;
    process.env.NODE_ENV = 'production';
    process.env.TASKYARD_REPO_ROOT = '/repo';
    expect(resolveDbPath()).toBe(path.join('/repo', 'data', 'taskyard.db'));
  });
});

describe('sandbox chrome', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects sandbox paths', () => {
    expect(isSandboxDbPath('/repo/data/taskyard-dev.db')).toBe(true);
    expect(isSandboxDbPath('/repo/data/taskyard.db')).toBe(false);
    expect(sandboxDbPath('/repo')).toBe(path.join('/repo', 'data', 'taskyard-dev.db'));
    expect(productionDbPath('/repo')).toBe(path.join('/repo', 'data', 'taskyard.db'));
  });

  it('shows chrome in development even on a custom path', () => {
    process.env.NODE_ENV = 'development';
    expect(shouldShowSandboxChrome('/custom.db')).toBe(true);
  });

  it('shows chrome in production only for the sandbox file', () => {
    process.env.NODE_ENV = 'production';
    expect(shouldShowSandboxChrome('/repo/data/taskyard-dev.db')).toBe(true);
    expect(shouldShowSandboxChrome('/repo/data/taskyard.db')).toBe(false);
  });
});
