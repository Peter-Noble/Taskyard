import { afterEach, describe, expect, it, vi } from 'vitest';
import { cmdSearch } from './search-cli.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('taskyard search', () => {
  it('searches the current project with agent-friendly defaults', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await cmdSearch('app wide', { project: 'project-1' }, false);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://taskyard.app/api/search?q=app+wide&type=task&limit=20&project_id=project-1',
      expect.any(Object),
    );
    expect(output).toHaveBeenCalledWith('{"results":[]}\n');
  });

  it('supports all projects and pretty results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        results: [{
          type: 'task',
          id: 'task-1',
          short_id: 'TA-20',
          title: 'App wide search',
          status: 'ready',
          project_id: 'project-1',
          project_name: 'Taskyard',
          updated_at: '2026-11-05T00:00:00.000Z',
          snippet: [{ text: 'App wide', match: true }],
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await cmdSearch('app', { allProjects: true, limit: '50' }, true);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://taskyard.app/api/search?q=app&type=task&limit=50&all_projects=1',
      expect.any(Object),
    );
    expect(output).toHaveBeenCalledWith(
      'TA-20\ttask\tready\tTaskyard\tApp wide search\n  App wide\n',
    );
  });

  it('rejects invalid scope before calling the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(cmdSearch('query', {
      project: 'project-1',
      allProjects: true,
    }, false)).rejects.toThrow(/cannot be used together/);
    await expect(cmdSearch('query', {
      type: 'idea',
      allProjects: true,
    }, false)).rejects.toThrow(/only valid for task search/);
    await expect(cmdSearch('query', { limit: '101' }, false)).rejects.toThrow(/between 1 and 100/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
