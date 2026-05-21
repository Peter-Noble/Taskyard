import fs from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from '@taskyard/db';

export const REPO_ROOT = findRepoRoot();

export function agentsDir(): string {
  return path.join(REPO_ROOT, 'agents');
}

export function projectsJsonPath(): string {
  return path.join(REPO_ROOT, 'projects.json');
}

export function readProjectsJson(): Array<{
  id?: string;
  name: string;
  repo_url: string;
  default_branch?: string;
}> {
  try {
    const raw = fs.readFileSync(projectsJsonPath(), 'utf8');
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data)
      ? (data as Array<{ id?: string; name: string; repo_url: string; default_branch?: string }>)
      : [];
  } catch {
    return [];
  }
}
