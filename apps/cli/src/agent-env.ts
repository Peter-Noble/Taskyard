import fs from 'node:fs';
import path from 'node:path';
import type { ServerMessage } from '@taskyard/protocol';
import { writeAgentsInstructions } from './agents-file.js';
import { writeProjectFile } from './project-file.js';

function findRepoRoot(start = process.cwd()): string {
  if (process.env.TASKYARD_REPO_ROOT) {
    return path.resolve(process.env.TASKYARD_REPO_ROOT);
  }
  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/** Prepends repo CLI paths so spawned agents can run `taskyard task …`. */
export function augmentPathForTaskyardCli(): string {
  const repoRoot = findRepoRoot();
  const extra = [
    path.join(repoRoot, 'apps', 'cli'),
    path.join(repoRoot, 'node_modules', '.bin'),
    path.join(repoRoot, 'apps', 'cli', 'node_modules', '.bin'),
  ];
  const existing = process.env.PATH ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const parts = [...extra, ...existing.split(sep)].filter(Boolean);
  return [...new Set(parts)].join(sep);
}

export function buildThreadAgentEnv(
  message: Extract<ServerMessage, { type: 'spawn_thread' }>,
  worktreePath: string,
  extra?: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PATH: augmentPathForTaskyardCli(),
    TASKYARD_SERVER_URL: process.env.TASKYARD_SERVER_URL ?? 'http://127.0.0.1:3000',
    TASKYARD_THREAD_ID: message.thread_id,
    TASKYARD_PROJECT_ID: message.project_id,
    TASKYARD_PROJECT: message.project,
    TASKYARD_WORKSPACE: path.resolve(worktreePath),
    TASKYARD_PROMPT: message.prompt,
    TASKYARD_ACTOR: `${message.agent_type}:${message.thread_id.slice(0, 8)}`,
    TASKYARD_SESSION: 'autonomous',
  };

  if (message.task_id) env.TASKYARD_TASK_ID = message.task_id;
  if (message.ports?.web) env.TASKYARD_WEB_PORT = String(message.ports.web);

  writeProjectFile(worktreePath, {
    project_id: message.project_id,
    server_url: env.TASKYARD_SERVER_URL,
  });
  // D-002
  writeAgentsInstructions(worktreePath);

  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value) env[key] = value;
  }

  return env;
}
