import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TASK_CLI_CONTRACT } from '@taskyard/core';
import { findProjectFile, readProjectFile, resolveProjectContext } from './project-file.js';

export const TASKYARD_AGENTS_START = '<!-- taskyard:start -->';
export const TASKYARD_AGENTS_END = '<!-- taskyard:end -->';

const CONTRACT_MARKER = /<!-- taskyard:contract ([0-9a-f]+) -->/;

export function agentsFilePath(workspace: string): string {
  return path.join(workspace, 'AGENTS.md');
}

/** Short stable id for the contract text. Stored in the AGENTS.md block, not hashed with it. */
export function agentsContractHash(contract: string = TASK_CLI_CONTRACT): string {
  return createHash('sha256').update(contract.trim()).digest('hex').slice(0, 12);
}

/** The managed block setup writes into `AGENTS.md`. Body is `TASK_CLI_CONTRACT`. */
export function taskyardAgentsBlock(contract: string = TASK_CLI_CONTRACT): string {
  const hash = agentsContractHash(contract);
  return `${TASKYARD_AGENTS_START}\n<!-- taskyard:contract ${hash} -->\n${contract.trim()}\n${TASKYARD_AGENTS_END}`;
}

/** Hash recorded in the first Taskyard block, or null when the block or marker is absent. */
export function agentsContractHashIn(text: string): string | null {
  const start = text.indexOf(TASKYARD_AGENTS_START);
  if (start === -1) return null;
  const end = text.indexOf(TASKYARD_AGENTS_END, start + TASKYARD_AGENTS_START.length);
  const region = end === -1 ? text.slice(start) : text.slice(start, end);
  return region.match(CONTRACT_MARKER)?.[1] ?? null;
}

function withTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

/**
 * Inserts the Taskyard block at the top of `existing`, or replaces the sentinel
 * region wherever it already sits. Text outside the sentinels is left in place.
 */
export function upsertTaskyardAgentsBlock(existing: string, block: string): string {
  const start = existing.indexOf(TASKYARD_AGENTS_START);
  if (start === -1) {
    if (!existing.trim()) return `${block}\n`;
    const rest = existing.replace(/^\uFEFF/, '').replace(/^\n+/, '');
    return withTrailingNewline(`${block}\n\n${rest}`);
  }

  const end = existing.indexOf(TASKYARD_AGENTS_END, start + TASKYARD_AGENTS_START.length);
  if (end === -1) {
    return withTrailingNewline(
      existing.slice(0, start) + block + existing.slice(start + TASKYARD_AGENTS_START.length),
    );
  }

  return withTrailingNewline(existing.slice(0, start) + block + existing.slice(end + TASKYARD_AGENTS_END.length));
}

/** Creates or refreshes the Taskyard section in the checkout's `AGENTS.md`. */
export function writeAgentsInstructions(
  workspace: string,
  contract: string = TASK_CLI_CONTRACT,
): { file: string; updated: boolean } {
  const file = agentsFilePath(workspace);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const next = upsertTaskyardAgentsBlock(existing, taskyardAgentsBlock(contract));
  const updated = next !== existing;
  if (updated) fs.writeFileSync(file, next);
  return { file, updated };
}

/** Prints the notice and the new Taskyard section. Goes to stdout so the caller, including an agent, receives it. */
export function announceUpdatedInstructions(file: string): void {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf(TASKYARD_AGENTS_START);
  const end = start === -1 ? -1 : text.indexOf(TASKYARD_AGENTS_END, start);
  const block =
    start === -1 || end === -1 ? text.trimEnd() : text.slice(start, end + TASKYARD_AGENTS_END.length);
  process.stdout.write(`taskyard: updated ${file}. Follow these instructions:\n\n${block}\n\n`);
}

/**
 * Rewrites the Taskyard section when its contract hash is missing or stale.
 * A matching hash leaves the file untouched, including any text outside the block.
 */
export function ensureAgentsInstructions(workspace: string, contract: string = TASK_CLI_CONTRACT): string {
  const file = agentsFilePath(workspace);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (agentsContractHashIn(existing) === agentsContractHash(contract)) return file;
  return writeAgentsInstructions(workspace, contract).file;
}

function projectRoot(): string | null {
  const { workspace } = resolveProjectContext();
  if (!workspace) return null;
  if (readProjectFile(workspace)) return workspace;
  return findProjectFile(workspace)?.workspace ?? null;
}

/** Refresh AGENTS.md when this process is running inside a Taskyard project. */
export function refreshAgentsInstructions(): void {
  const root = projectRoot();
  if (!root) return;
  const existing = fs.existsSync(agentsFilePath(root)) ? fs.readFileSync(agentsFilePath(root), 'utf8') : '';
  if (agentsContractHashIn(existing) === agentsContractHash()) return;
  const written = writeAgentsInstructions(root);
  if (written.updated) announceUpdatedInstructions(written.file);
}

/** Every taskyard command checks the project AGENTS.md before it does its own work. */
export function registerAgentsRefresh(program: {
  hook: (event: 'preAction', listener: () => void) => unknown;
}): void {
  program.hook('preAction', () => {
    try {
      refreshAgentsInstructions();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`taskyard: could not refresh AGENTS.md: ${message}\n`);
    }
  });
}
