import { describe, expect, it } from 'vitest';
import { createTestDb, seedOnlineMachine, seedThread } from '@taskyard/test-utils';
import { normalizePlacement, PlacementError, resolvePlacement } from './placement.js';

describe('resolvePlacement', () => {
  it('auto picks highest-scoring auto machine', () => {
    const ctx = createTestDb();
    try {
      seedOnlineMachine(ctx.db, {
        id: 'm-low',
        name: 'low',
        ramUsedGb: 20,
        cpuPercent: 50,
        priority: 0,
      });
      seedOnlineMachine(ctx.db, {
        id: 'm-high',
        name: 'high',
        ramUsedGb: 2,
        cpuPercent: 5,
        priority: 0,
      });

      const id = resolvePlacement(ctx.db, {
        projectId: 'proj-1',
        agentType: 'stub',
        placement: { mode: 'auto' },
      });
      expect(id).toBe('m-high');
    } finally {
      ctx.cleanup();
    }
  });

  it('local requires an online is_local machine', () => {
    const ctx = createTestDb();
    try {
      seedOnlineMachine(ctx.db, { id: 'remote', isLocal: false });
      expect(() =>
        resolvePlacement(ctx.db, {
          projectId: 'p',
          agentType: 'stub',
          placement: { mode: 'local' },
        }),
      ).toThrow(PlacementError);
    } finally {
      ctx.cleanup();
    }
  });

  it('local picks the local worker when eligible', () => {
    const ctx = createTestDb();
    try {
      seedOnlineMachine(ctx.db, { id: 'remote', isLocal: false });
      seedOnlineMachine(ctx.db, { id: 'local', isLocal: true, name: 'my-mac' });

      const id = resolvePlacement(ctx.db, {
        projectId: 'p',
        agentType: 'stub',
        placement: { mode: 'local' },
      });
      expect(id).toBe('local');
    } finally {
      ctx.cleanup();
    }
  });

  it('pool filters by pool name', () => {
    const ctx = createTestDb();
    try {
      seedOnlineMachine(ctx.db, { id: 'a', pool: 'homelab' });
      seedOnlineMachine(ctx.db, { id: 'b', pool: 'gpu' });

      const id = resolvePlacement(ctx.db, {
        projectId: 'p',
        agentType: 'stub',
        placement: { mode: 'pool', pool: 'gpu' },
      });
      expect(id).toBe('b');
    } finally {
      ctx.cleanup();
    }
  });

  it('respects max_concurrent_threads', () => {
    const ctx = createTestDb();
    try {
      const m = seedOnlineMachine(ctx.db, { id: 'busy', maxConcurrentThreads: 1 });
      seedThread(ctx.db, 't1', m.id, { status: 'running' });

      expect(() =>
        resolvePlacement(ctx.db, {
          projectId: 'p',
          agentType: 'stub',
          placement: { mode: 'machine', machine_id: 'busy' },
        }),
      ).toThrow(PlacementError);
    } finally {
      ctx.cleanup();
    }
  });

  it('normalizePlacement maps legacy machine_id', () => {
    expect(normalizePlacement({ machine_id: 'abc' })).toEqual({
      mode: 'machine',
      machine_id: 'abc',
    });
  });
});
