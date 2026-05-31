import { describe, expect, it, vi } from 'vitest';
import { createLineBuffer, parseLogLine } from './events.js';

describe('events', () => {
  it('parses valid JSON agent events', () => {
    expect(parseLogLine('{"type":"thought","content":"hello"}')).toEqual({
      type: 'thought',
      content: 'hello',
    });
  });

  it('falls back to stdout for non-JSON lines', () => {
    expect(parseLogLine('plain log line')).toEqual({
      type: 'stdout',
      content: 'plain log line',
    });
  });

  it('buffers partial lines across chunks', () => {
    const lines: string[] = [];
    const onChunk = createLineBuffer((line) => lines.push(line));

    onChunk(Buffer.from('{"type":"system","event":"start"}\n{"type":"thought","'));
    onChunk(Buffer.from('content":"hi"}\n'));

    expect(lines).toEqual(['{"type":"system","event":"start"}', '{"type":"thought","content":"hi"}']);
  });

  it('ignores empty lines', () => {
    const onLine = vi.fn();
    const onChunk = createLineBuffer(onLine);

    onChunk(Buffer.from('\n\n'));

    expect(onLine).not.toHaveBeenCalled();
  });
});
