import { projects } from '@taskyard/db';
import { count, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { TaskyardDb } from '@taskyard/db';
import { readProjectsJson } from './paths.js';
import { formatProject } from './format.js';

export function seedProjectsIfEmpty(db: TaskyardDb): void {
  const row = db.select({ value: count() }).from(projects).get();
  if ((row?.value ?? 0) > 0) return;

  for (const p of readProjectsJson()) {
    db.insert(projects)
      .values({
        id: p.id ?? randomUUID(),
        name: p.name,
        repoUrl: p.repo_url,
        defaultBranch: p.default_branch ?? 'main',
      })
      .run();
  }
}

export function listProjects(db: TaskyardDb) {
  return db.select().from(projects).all().map(formatProject);
}

export function getProjectById(db: TaskyardDb, id: string) {
  return db.select().from(projects).where(eq(projects.id, id)).get();
}
