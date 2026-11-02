import { describe, expect, it } from 'vitest';
import { createSseResponse } from './sse';

describe('SSE polling', () => {
  it('advances past skipped private events without emitting them', async () => {
    const cursors: number[] = [];
    const response = createSseResponse((_db, since) => {
      cursors.push(since);
      if (since === 0) return [{ id: 1, skip: true }, { id: 2, thread_id: 'public-1' }];
      return [{ id: 3, thread_id: 'public-2' }];
    }, '0');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const first = decoder.decode((await reader.read()).value);
    expect(first).toContain('public-1');
    expect(first).not.toContain('skip');
    const second = decoder.decode((await reader.read()).value);
    expect(second).toContain('public-2');
    expect(cursors.slice(0, 2)).toEqual([0, 2]);
    await reader.cancel();
  });
});
