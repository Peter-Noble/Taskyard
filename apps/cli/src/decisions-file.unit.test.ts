import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TaskDecision } from '@taskyard/protocol';
import { syncDecisionsFile } from './decisions-file.js';

function decision(id: string): TaskDecision {
  return {
    id,
    task_id: 'task-1',
    task_short_id: 'TA-1',
    project_id: 'project-1',
    choice: 'One worktree per thread',
    why: 'Agents must not share a dirty checkout',
    status: 'accepted',
    exported_at: null,
    created_at: new Date().toISOString(),
  };
}

describe('syncDecisionsFile', () => {
  it('appends a decision once', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-decisions-'));
    try {
      const first = syncDecisionsFile(dir, [decision('D-001')]);
      const second = syncDecisionsFile(dir, [decision('D-001')]);
      const text = fs.readFileSync(path.join(dir, '.taskyard', 'decisions.md'), 'utf8');
      expect(first).toEqual(['D-001']);
      expect(second).toEqual(['D-001']);
      expect(text.match(/## D-001/g)).toHaveLength(1);
      expect(text).toContain('Agents must not share a dirty checkout');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
