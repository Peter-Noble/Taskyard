import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertSafeTestEnv, isDevDbPath, isSafeTestDbPath } from './env-guard.js';

describe('env-guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('detects protected project database paths', () => {
    expect(isDevDbPath('/repo/data/taskyard.db')).toBe(true);
    expect(isDevDbPath('/repo/data/taskyard-dev.db')).toBe(true);
    expect(isDevDbPath(path.join('D:', 'Taskyard', 'data', 'taskyard.db'))).toBe(true);
    expect(isDevDbPath(path.join('D:', 'Taskyard', 'data', 'taskyard-dev.db'))).toBe(true);
  });

  it('allows temp and memory database paths', () => {
    const tempDb = path.join(os.tmpdir(), 'taskyard-test-abc', 'test.db');
    expect(isSafeTestDbPath(tempDb)).toBe(true);
    expect(isSafeTestDbPath(':memory:')).toBe(true);
    expect(isSafeTestDbPath(path.join('D:', 'Taskyard', 'data', 'taskyard.db'))).toBe(false);
    expect(isSafeTestDbPath(path.join('D:', 'Taskyard', 'data', 'taskyard-dev.db'))).toBe(false);
  });

  it('assertSafeTestEnv rejects project database paths', () => {
    process.env.NODE_ENV = 'test';
    process.env.TASKYARD_DB_PATH = path.join(os.tmpdir(), 'taskyard-test', 'test.db');
    expect(() => assertSafeTestEnv()).not.toThrow();

    process.env.TASKYARD_DB_PATH = path.join('D:', 'Taskyard', 'data', 'taskyard.db');
    expect(() => assertSafeTestEnv()).toThrow(/dev database/i);

    process.env.TASKYARD_DB_PATH = path.join('D:', 'Taskyard', 'data', 'taskyard-dev.db');
    expect(() => assertSafeTestEnv()).toThrow(/dev database/i);
  });
});
