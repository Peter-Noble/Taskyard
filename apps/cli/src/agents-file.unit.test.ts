import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TASK_CLI_CONTRACT } from '@taskyard/core';
import { Command } from 'commander';
import { describe, expect, it } from 'vitest';
import {
  TASKYARD_AGENTS_END,
  TASKYARD_AGENTS_START,
  agentsContractHash,
  agentsContractHashIn,
  ensureAgentsInstructions,
  refreshAgentsInstructions,
  registerAgentsRefresh,
  taskyardAgentsBlock,
  upsertTaskyardAgentsBlock,
  writeAgentsInstructions,
} from './agents-file.js';
import { writeProjectFile } from './project-file.js';

const BLOCK = `${TASKYARD_AGENTS_START}\n## Taskyard\nUse the CLI.\n${TASKYARD_AGENTS_END}`;

describe('AGENTS.md taskyard block', () => {
  it('creates AGENTS.md from the CLI contract when the file is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agents-'));
    try {
      const file = writeAgentsInstructions(dir).file;
      const text = fs.readFileSync(file, 'utf8');
      expect(text.startsWith(`${TASKYARD_AGENTS_START}\n`)).toBe(true);
      expect(text).toContain(`<!-- taskyard:contract ${agentsContractHash()} -->`);
      expect(agentsContractHashIn(text)).toBe(agentsContractHash());
      expect(text).toContain(TASK_CLI_CONTRACT.trim());
      expect(text.trimEnd().endsWith(TASKYARD_AGENTS_END)).toBe(true);
      writeAgentsInstructions(dir);
      expect(fs.readFileSync(file, 'utf8')).toBe(text);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prepends the block and leaves the rest of an existing AGENTS.md', () => {
    const original = '# Project\n\nKeep this.\n';
    const next = upsertTaskyardAgentsBlock(original, BLOCK);
    expect(next.startsWith(`${BLOCK}\n\n# Project\n\nKeep this.\n`)).toBe(true);
    expect(next.match(/taskyard:start/g)).toHaveLength(1);
    expect(upsertTaskyardAgentsBlock(next, BLOCK)).toBe(next);
  });

  it('refreshes an existing block in place', () => {
    const original = `# Intro\n\n${TASKYARD_AGENTS_START}\nold contract\n${TASKYARD_AGENTS_END}\n\n# More\n`;
    const next = upsertTaskyardAgentsBlock(original, BLOCK);
    expect(next).toBe(`# Intro\n\n${BLOCK}\n\n# More\n`);
  });

  it('closes a start marker that has no end without dropping the following text', () => {
    const original = `# Intro\n\n${TASKYARD_AGENTS_START}\n# More\n`;
    expect(upsertTaskyardAgentsBlock(original, BLOCK)).toBe(`# Intro\n\n${BLOCK}\n# More\n`);
  });

  it('rewrites the section when the contract hash is missing or stale, and leaves a match untouched', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agents-'));
    try {
      const file = path.join(dir, 'AGENTS.md');
      fs.writeFileSync(
        file,
        `${TASKYARD_AGENTS_START}\n## Taskyard\nold instructions\n${TASKYARD_AGENTS_END}\n\n# Notes\n`,
      );
      ensureAgentsInstructions(dir);
      expect(fs.readFileSync(file, 'utf8')).toBe(`${taskyardAgentsBlock()}\n\n# Notes\n`);

      fs.writeFileSync(
        file,
        `${TASKYARD_AGENTS_START}\n<!-- taskyard:contract 000000000000 -->\n## Taskyard\nstale\n${TASKYARD_AGENTS_END}\n`,
      );
      ensureAgentsInstructions(dir);
      const refreshed = fs.readFileSync(file, 'utf8');
      expect(agentsContractHashIn(refreshed)).toBe(agentsContractHash());
      expect(refreshed).toContain(TASK_CLI_CONTRACT.trim());

      const stamped = fs.statSync(file).mtimeMs;
      ensureAgentsInstructions(dir);
      expect(fs.statSync(file).mtimeMs).toBe(stamped);
      expect(fs.readFileSync(file, 'utf8')).toBe(refreshed);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refreshes AGENTS.md for a project checkout and skips a directory that is not one', async () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agents-project-'));
    const loose = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agents-loose-'));
    const previous = process.env.TASKYARD_WORKSPACE;
    const chunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as typeof process.stdout.write;
    try {
      writeProjectFile(project, { project_id: 'proj-1' });
      fs.writeFileSync(path.join(project, 'AGENTS.md'), '# Keep\n');
      process.env.TASKYARD_WORKSPACE = project;
      refreshAgentsInstructions();
      const agentsFile = path.join(project, 'AGENTS.md');
      expect(fs.readFileSync(agentsFile, 'utf8')).toContain(agentsContractHash());
      expect(fs.readFileSync(agentsFile, 'utf8')).toContain('# Keep');
      const announced = chunks.join('');
      expect(announced).toContain(`taskyard: updated ${agentsFile}. Follow these instructions:`);
      expect(announced).toContain(TASK_CLI_CONTRACT.trim());
      expect(announced).toContain(TASKYARD_AGENTS_END);

      chunks.length = 0;
      refreshAgentsInstructions();
      expect(chunks.join('')).toBe('');

      process.env.TASKYARD_WORKSPACE = loose;
      refreshAgentsInstructions();
      expect(fs.existsSync(path.join(loose, 'AGENTS.md'))).toBe(false);
      expect(chunks.join('')).toBe('');

      fs.writeFileSync(agentsFile, `${TASKYARD_AGENTS_START}\nold\n${TASKYARD_AGENTS_END}\n`);
      process.env.TASKYARD_WORKSPACE = project;
      const program = new Command();
      program.exitOverride();
      registerAgentsRefresh(program);
      program.command('ping').action(() => {});
      await program.parseAsync(['ping'], { from: 'user' });
      expect(agentsContractHashIn(fs.readFileSync(agentsFile, 'utf8'))).toBe(agentsContractHash());
      const fromCommand = chunks.join('');
      expect(fromCommand).toContain(`taskyard: updated ${agentsFile}. Follow these instructions:`);
      expect(fromCommand).toContain(TASK_CLI_CONTRACT.trim());

      chunks.length = 0;
      await program.parseAsync(['ping'], { from: 'user' });
      expect(chunks.join('')).toBe('');
    } finally {
      process.stdout.write = originalWrite;
      if (previous === undefined) delete process.env.TASKYARD_WORKSPACE;
      else process.env.TASKYARD_WORKSPACE = previous;
      fs.rmSync(project, { recursive: true, force: true });
      fs.rmSync(loose, { recursive: true, force: true });
    }
  });
});
