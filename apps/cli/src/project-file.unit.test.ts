import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findProjectFile, writeProjectFile } from './project-file.js';

describe('project file', () => {
  it('finds .taskyard/project.json by walking up from a nested directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-project-'));
    try {
      const nested = path.join(root, 'src', 'app');
      fs.mkdirSync(nested, { recursive: true });
      writeProjectFile(root, { project_id: 'proj-1', server_url: 'http://127.0.0.1:3000' });
      const found = findProjectFile(nested);
      expect(found?.workspace).toBe(root);
      expect(found?.file.project_id).toBe('proj-1');
      expect(found?.file.server_url).toBe('http://127.0.0.1:3000');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not overwrite an existing project file unless asked', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ty-project-'));
    try {
      writeProjectFile(root, { project_id: 'proj-1' });
      writeProjectFile(root, { project_id: 'proj-2' });
      expect(findProjectFile(root)?.file.project_id).toBe('proj-1');
      writeProjectFile(root, { project_id: 'proj-2' }, { overwrite: true });
      expect(findProjectFile(root)?.file.project_id).toBe('proj-2');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
