import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TASK_CLI_CONTRACT } from '@taskyard/core';
import { TASK_CLI_CONTRACT_REVISION } from '@taskyard/core/task-cli-contract';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
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
  it('matches the published revision history', () => {
    // Append the new hash when increasing the contract revision. Published hashes stay fixed.
    const publishedHashes = ['02f0bf0188e3'];
    expect(TASK_CLI_CONTRACT_REVISION).toBe(publishedHashes.length);
    expect(agentsContractHash()).toBe(publishedHashes.at(-1));
  });

  it('creates AGENTS.md from the CLI contract when the file is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agents-'));
    try {
      const file = writeAgentsInstructions(dir).file;
      const text = fs.readFileSync(file, 'utf8');
      expect(text.startsWith(`${TASKYARD_AGENTS_START}\n`)).toBe(true);
      expect(text).toContain(`<!-- taskyard:contract ${agentsContractHash()} -->`);
      expect(text).toContain(`<!-- taskyard:contract-revision ${TASK_CLI_CONTRACT_REVISION} -->`);
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

  it('upgrades older revisions and leaves a match untouched', () => {
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
        taskyardAgentsBlock().replace(/contract-revision \d+/, 'contract-revision 0'),
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

  it('preserves newer, conflicting, and unknown instructions', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agents-'));
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    try {
      const file = path.join(dir, 'AGENTS.md');
      const block = taskyardAgentsBlock();
      const examples = [
        {
          text: block.replace(/contract-revision \d+/, `contract-revision ${TASK_CLI_CONTRACT_REVISION + 1}`),
          warning: 'CLI update required to refresh project instructions',
        },
        {
          text: block.replace(agentsContractHash(), '000000000000'),
          warning: 'could not be verified',
        },
        {
          text: block.replace(/<!-- taskyard:contract-revision \d+ -->\n/, '')
            .replace(agentsContractHash(), '000000000000'),
          warning: 'could not be verified',
        },
        {
          text: block.replace('## Taskyard', '## Edited instructions'),
          warning: 'could not be verified',
        },
      ];
      for (const { text, warning } of examples) {
        fs.writeFileSync(file, text);
        expect(writeAgentsInstructions(dir).updated).toBe(false);
        expect(fs.readFileSync(file, 'utf8')).toBe(text);
        expect(stderr).toHaveBeenLastCalledWith(expect.stringContaining(warning));
      }
    } finally {
      stderr.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refreshes AGENTS.md for a project checkout and skips a directory that is not one', async () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agents-project-'));
    const loose = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-agents-loose-'));
    const previous = process.env.TASKYARD_WORKSPACE;
    const chunks: string[] = [];
    const originalWrite = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as typeof process.stderr.write;
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
      process.stderr.write = originalWrite;
      if (previous === undefined) delete process.env.TASKYARD_WORKSPACE;
      else process.env.TASKYARD_WORKSPACE = previous;
      fs.rmSync(project, { recursive: true, force: true });
      fs.rmSync(loose, { recursive: true, force: true });
    }
  });
});
