import type { AgentEvent } from '@taskyard/protocol';

export function parseLogLine(line: string): AgentEvent {
  const trimmed = line.trim();
  if (!trimmed) return { type: 'stdout', content: '' };

  try {
    const parsed = JSON.parse(trimmed) as AgentEvent;
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      return parsed;
    }
  } catch {
    // fall through
  }

  return { type: 'stdout', content: trimmed };
}

export function createLineBuffer(onLine: (line: string) => void): (chunk: Buffer) => void {
  let buffer = '';

  return (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length > 0) onLine(line);
    }
  };
}

export function flushLineBuffer(buffer: string, onLine: (line: string) => void): void {
  if (buffer.trim()) onLine(buffer);
}
