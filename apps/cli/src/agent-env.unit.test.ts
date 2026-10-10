import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TASK_CLI_CONTRACT } from '@taskyard/core';
import type { ServerMessage } from '@taskyard/protocol';
import { describe, expect, it } from 'vitest';
import { buildThreadAgentEnv } from './agent-env.js';
import { agentsContractHash, TASKYARD_AGENTS_END, TASKYARD_AGENTS_START } from './agents-file.js';

function spawnMessage(): Extract<ServerMessage, { type: 'spawn_thread' }> {
  return {
    type: 'spawn_thread',
    thread_id: 'thread-12345678',
    project_id: 'proj-1',
    project: 'Taskyard',
    repo_url: 'https://example.com/repo.git',
    branch: 'main',
    agent_type: 'cursor',
    prompt: 'Do the work',
    env: {},
  };
}

describe('thread worktree preparation', () => {
  it('writes the project file and upserts the Taskyard block without dropping other AGENTS.md text', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agent-env-'));
    try {
      fs.writeFileSync(path.join(dir, 'AGENTS.md'), '# Project\n\nKeep this.\n');
      const env = buildThreadAgentEnv(spawnMessage(), dir);
      expect(env.TASKYARD_PROJECT_ID).toBe('proj-1');
      expect(env.TASKYARD_WORKSPACE).toBe(path.resolve(dir));

      const project = JSON.parse(fs.readFileSync(path.join(dir, '.taskyard', 'project.json'), 'utf8')) as {
        project_id: string;
      };
      expect(project.project_id).toBe('proj-1');

      const text = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
      expect(text.startsWith(`${TASKYARD_AGENTS_START}\n`)).toBe(true);
      expect(text).toContain(`<!-- taskyard:contract ${agentsContractHash()} -->`);
      expect(text).toContain(TASK_CLI_CONTRACT.trim());
      expect(text).toContain('# Project\n\nKeep this.\n');
      expect(text.match(/taskyard:start/g)).toHaveLength(1);
      expect(text.trimEnd().endsWith('# Project\n\nKeep this.')).toBe(true);
      expect(text).toContain(TASKYARD_AGENTS_END);

      buildThreadAgentEnv(spawnMessage(), dir);
      expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).toBe(text);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('replaces an existing Taskyard block in place', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agent-env-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'AGENTS.md'),
        `# Intro\n\n${TASKYARD_AGENTS_START}\nold contract\n${TASKYARD_AGENTS_END}\n\n# More\n`,
      );
      buildThreadAgentEnv(spawnMessage(), dir);
      const text = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
      expect(text.startsWith(`# Intro\n\n${TASKYARD_AGENTS_START}\n`)).toBe(true);
      expect(text).toContain(TASK_CLI_CONTRACT.trim());
      expect(text).toContain('# More\n');
      expect(text.match(/taskyard:start/g)).toHaveLength(1);
      expect(text).not.toContain('old contract');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates AGENTS.md when the worktree has none', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agent-env-'));
    try {
      buildThreadAgentEnv(spawnMessage(), dir);
      const text = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
      expect(text.startsWith(`${TASKYARD_AGENTS_START}\n`)).toBe(true);
      expect(text).toContain(TASK_CLI_CONTRACT.trim());
      expect(text.trimEnd().endsWith(TASKYARD_AGENTS_END)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
