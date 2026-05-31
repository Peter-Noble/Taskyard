import { afterEach, describe, expect, it } from 'vitest';
import { createTestDb, seedOnlineMachine, seedThread, type TestDbContext } from '@taskyard/test-utils';
import { allocatePorts, getAllocatedPorts, PortExhaustedError, releasePorts } from './port-registry.js';

describe('port-registry', () => {
  let ctx: TestDbContext;

  afterEach(() => {
    ctx?.cleanup();
  });

  it('allocates two consecutive free ports per thread', () => {
    ctx = createTestDb();
    const machine = seedOnlineMachine(ctx.db, { portRangeStart: 30000, portRangeEnd: 30005 });
    seedThread(ctx.db, 'thread-1', machine.id);
    seedThread(ctx.db, 'thread-2', machine.id);

    const first = allocatePorts(ctx.db, machine.id, 'thread-1');
    expect(first).toEqual({ web: 30000, rustdesk: 30001 });

    const second = allocatePorts(ctx.db, machine.id, 'thread-2');
    expect(second).toEqual({ web: 30002, rustdesk: 30003 });
    expect(getAllocatedPorts(ctx.db, machine.id)).toEqual([30000, 30001, 30002, 30003]);
  });

  it('releases ports when a thread closes', () => {
    ctx = createTestDb();
    const machine = seedOnlineMachine(ctx.db);
    seedThread(ctx.db, 'thread-1', machine.id);
    seedThread(ctx.db, 'thread-2', machine.id);

    allocatePorts(ctx.db, machine.id, 'thread-1');
    releasePorts(ctx.db, 'thread-1');

    expect(getAllocatedPorts(ctx.db, machine.id)).toEqual([]);

    const again = allocatePorts(ctx.db, machine.id, 'thread-2');
    expect(again).toEqual({ web: 30000, rustdesk: 30001 });
  });

  it('throws when the machine port range is exhausted', () => {
    ctx = createTestDb();
    const machine = seedOnlineMachine(ctx.db, { portRangeStart: 30000, portRangeEnd: 30001 });
    seedThread(ctx.db, 'thread-1', machine.id);
    seedThread(ctx.db, 'thread-2', machine.id);

    allocatePorts(ctx.db, machine.id, 'thread-1');

    expect(() => allocatePorts(ctx.db, machine.id, 'thread-2')).toThrow(PortExhaustedError);
  });
});
