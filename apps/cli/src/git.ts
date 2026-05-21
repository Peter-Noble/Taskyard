import fs from 'node:fs';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { mirrorPath, worktreePath } from './config.js';

export async function ensureMirror(projectName: string, repoUrl: string): Promise<string> {
  const mirror = mirrorPath(projectName);
  fs.mkdirSync(path.dirname(mirror), { recursive: true });

  if (!fs.existsSync(mirror)) {
    console.log(`Cloning mirror for ${projectName}...`);
    await simpleGit().clone(repoUrl, mirror, ['--mirror']);
  } else {
    console.log(`Updating mirror for ${projectName}...`);
    await simpleGit(mirror).remote(['update']);
  }

  return mirror;
}

async function refExists(mirror: string, ref: string): Promise<boolean> {
  try {
    await simpleGit(mirror).raw(['rev-parse', '--verify', ref]);
    return true;
  } catch {
    return false;
  }
}

export async function createWorktree(
  mirror: string,
  threadId: string,
  branch: string,
): Promise<string> {
  const wtPath = worktreePath(threadId);
  if (fs.existsSync(wtPath)) {
    await removeWorktree(mirror, threadId, true);
  }

  const git = simpleGit(mirror);

  if (await refExists(mirror, branch)) {
    await git.raw(['worktree', 'add', wtPath, branch]);
  } else if (await refExists(mirror, `origin/${branch}`)) {
    await git.raw(['worktree', 'add', '-b', branch, wtPath, `origin/${branch}`]);
  } else if (await refExists(mirror, 'origin/main')) {
    await git.raw(['worktree', 'add', '-b', branch, wtPath, 'origin/main']);
  } else {
    await git.raw(['worktree', 'add', '-b', branch, wtPath, 'origin/master']);
  }

  console.log(`Worktree ready: ${wtPath} (${branch})`);
  return wtPath;
}

export async function removeWorktree(
  mirror: string,
  threadId: string,
  force = false,
): Promise<void> {
  const wtPath = worktreePath(threadId);
  if (!fs.existsSync(wtPath)) return;

  const git = simpleGit(mirror);
  const args = ['worktree', 'remove', wtPath];
  if (force) args.push('--force');

  try {
    await git.raw(args);
  } catch (err) {
    console.warn(`Worktree remove failed (${wtPath}):`, err);
    if (force) {
      fs.rmSync(wtPath, { recursive: true, force: true });
    }
  }
}
