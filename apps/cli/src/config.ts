import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DOCKER_IMAGE = process.env.TASKYARD_IMAGE ?? 'taskyard-base-image';

// NOTE: Canonical findRepoRoot lives in @taskyard/db. This local copy avoids
// pulling in the DB package just for path resolution.
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

const repoRoot = findRepoRoot();

export function getAgentsDir(explicit?: string): string {
  return path.resolve(explicit ?? process.env.TASKYARD_AGENTS_DIR ?? path.join(repoRoot, 'agents'));
}

export function cacheDir(): string {
  return path.join(os.homedir(), '.cache', 'taskyard');
}

export function mirrorPath(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(cacheDir(), 'repos', `${safe}.git`);
}

export function worktreePath(threadId: string): string {
  return path.join(os.tmpdir(), `taskyard-wt-${threadId}`);
}

export function containerName(threadId: string): string {
  return `taskyard-${threadId}`;
}
