import { projects, threads } from '@taskyard/db';
import { and, count, eq, ne, notInArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { TaskyardDb } from '@taskyard/db';
import type { CreateProjectRequest, UpdateProjectRequest } from '@taskyard/protocol';
import { readProjectsJson } from './paths.js';
import { formatProject } from './format.js';

export class ProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectError';
  }
}

export function isValidHttpsRepoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeRepoUrl(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function assertRepoUrl(repoUrl: string | null | undefined): string | null {
  const normalized = normalizeRepoUrl(repoUrl);
  if (normalized && !isValidHttpsRepoUrl(normalized)) {
    throw new ProjectError('Repository URL must use HTTPS');
  }
  return normalized;
}

export function seedProjectsIfEmpty(db: TaskyardDb): void {
  const row = db.select({ value: count() }).from(projects).get();
  if ((row?.value ?? 0) > 0) return;

  for (const p of readProjectsJson()) {
    db.insert(projects)
      .values({
        id: p.id ?? randomUUID(),
        name: p.name,
        repoUrl: assertRepoUrl(p.repo_url),
        defaultBranch: p.default_branch ?? 'main',
      })
      .run();
  }
}

function countActiveThreads(db: TaskyardDb, projectId: string): number {
  const row = db
    .select({ value: count() })
    .from(threads)
    .where(
      and(
        eq(threads.projectId, projectId),
        notInArray(threads.status, ['completed', 'error', 'closed']),
      ),
    )
    .get();
  return row?.value ?? 0;
}

export function listProjects(db: TaskyardDb, opts?: { includeArchived?: boolean }) {
  const rows = opts?.includeArchived
    ? db.select().from(projects).all()
    : db.select().from(projects).where(eq(projects.archived, false)).all();

  return rows.map((row) => ({
    ...formatProject(row),
    active_threads: countActiveThreads(db, row.id),
  }));
}

export function getProjectById(db: TaskyardDb, id: string) {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}

function assertUniqueName(db: TaskyardDb, name: string, excludeId?: string): void {
  const existing = excludeId
    ? db
        .select()
        .from(projects)
        .where(and(eq(projects.name, name), ne(projects.id, excludeId)))
        .get()
    : db.select().from(projects).where(eq(projects.name, name)).get();
  if (existing) throw new ProjectError(`Project name already in use: ${name}`);
}

export function createProject(db: TaskyardDb, req: CreateProjectRequest) {
  const name = req.name.trim();
  if (!name) throw new ProjectError('Project name is required');

  const repoUrl = assertRepoUrl(req.repo_url);
  assertUniqueName(db, name);

  const id = randomUUID();
  db.insert(projects)
    .values({
      id,
      name,
      repoUrl,
      defaultBranch: req.default_branch?.trim() || 'main',
    })
    .run();

  const row = getProjectById(db, id)!;
  return { ...formatProject(row), active_threads: 0 };
}

export function updateProject(db: TaskyardDb, id: string, req: UpdateProjectRequest) {
  const existing = getProjectById(db, id);
  if (!existing) return null;

  const values: Partial<typeof projects.$inferInsert> = {};

  if (req.name !== undefined) {
    const name = req.name.trim();
    if (!name) throw new ProjectError('Project name is required');
    assertUniqueName(db, name, id);
    values.name = name;
  }

  if (req.repo_url !== undefined) {
    values.repoUrl = assertRepoUrl(req.repo_url);
  }

  if (req.default_branch !== undefined) {
    const branch = req.default_branch.trim();
    if (!branch) throw new ProjectError('Default branch is required');
    values.defaultBranch = branch;
  }

  if (req.archived !== undefined) {
    values.archived = req.archived;
    values.archivedAt = req.archived ? new Date() : null;
  }

  if (Object.keys(values).length === 0) {
    return {
      ...formatProject(existing),
      active_threads: countActiveThreads(db, id),
    };
  }

  db.update(projects).set(values).where(eq(projects.id, id)).run();
  const row = getProjectById(db, id)!;
  return {
    ...formatProject(row),
    active_threads: countActiveThreads(db, id),
  };
}
