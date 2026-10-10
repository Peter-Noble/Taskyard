import fs from 'node:fs';
import path from 'node:path';

export type ProjectFile = {
  project_id: string;
  server_url?: string;
};

const DIR_NAME = '.taskyard';
const FILE_NAME = 'project.json';

export function projectDir(workspace: string): string {
  return path.join(workspace, DIR_NAME);
}

export function decisionsFilePath(workspace: string): string {
  return path.join(projectDir(workspace), 'decisions.md');
}

function readProjectFileAt(dir: string): ProjectFile | null {
  const file = path.join(dir, DIR_NAME, FILE_NAME);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ProjectFile;
    if (!parsed.project_id || typeof parsed.project_id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Reads `.taskyard/project.json` in `dir` itself, without walking up. */
export function readProjectFile(dir: string): ProjectFile | null {
  return readProjectFileAt(dir);
}
export function findProjectFile(start: string): { workspace: string; file: ProjectFile } | null {
  let dir = path.resolve(start);
  while (true) {
    const file = readProjectFileAt(dir);
    if (file) return { workspace: dir, file };
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function writeProjectFile(
  workspace: string,
  file: ProjectFile,
  opts?: { overwrite?: boolean },
): string {
  const dir = projectDir(workspace);
  const target = path.join(dir, FILE_NAME);
  if (!opts?.overwrite && fs.existsSync(target)) return target;
  fs.mkdirSync(dir, { recursive: true });
  const body: ProjectFile = { project_id: file.project_id };
  if (file.server_url) body.server_url = file.server_url;
  fs.writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`);
  return target;
}

export function resolveProjectContext(explicitProject?: string): {
  projectId?: string;
  serverUrl: string;
  workspace?: string;
} {
  const starts = [process.env.TASKYARD_WORKSPACE, process.cwd()].filter(
    (value): value is string => Boolean(value),
  );
  let found: ReturnType<typeof findProjectFile> = null;
  for (const start of starts) {
    found = findProjectFile(start);
    if (found) break;
  }

  const projectId =
    explicitProject?.trim() || process.env.TASKYARD_PROJECT_ID?.trim() || found?.file.project_id;
  const serverUrl =
    process.env.TASKYARD_SERVER_URL?.trim() ||
    found?.file.server_url ||
    'http://127.0.0.1:3000';
  const workspace = process.env.TASKYARD_WORKSPACE?.trim() || found?.workspace;

  return { projectId, serverUrl, workspace };
}
