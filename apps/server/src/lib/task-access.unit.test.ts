import { getDb, listTasks, personFromToken, type WebSession } from '@taskyard/core';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as decisions from '@/app/api/decisions/route';
import * as exportDecisions from '@/app/api/decisions/exported/route';
import * as events from '@/app/api/events/route';
import * as projects from '@/app/api/projects/route';
import * as search from '@/app/api/search/route';
import * as tasks from '@/app/api/tasks/route';
import * as task from '@/app/api/tasks/[id]/route';
import * as claim from '@/app/api/tasks/[id]/claim/route';
import * as comments from '@/app/api/tasks/[id]/comments/route';
import * as taskDecisions from '@/app/api/tasks/[id]/decisions/route';
import * as dependencies from '@/app/api/tasks/[id]/dependencies/route';
import * as nextTask from '@/app/api/tasks/next/route';
import * as taskStream from '@/app/api/tasks/stream/route';
import * as thread from '@/app/api/threads/[id]/route';
import * as threadEvents from '@/app/api/threads/[id]/events/route';
import * as threads from '@/app/api/threads/route';
import { config, middleware } from '@/middleware';

vi.mock('@taskyard/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@taskyard/core')>(),
  getDb: vi.fn(() => ({})),
  listTasks: vi.fn(() => []),
  personFromToken: vi.fn(),
}));

const context = { params: Promise.resolve({ id: 'fixture-id' }) };
const session: WebSession = {
  sessionId: 'session-id',
  kind: 'web',
  mustChangePassword: false,
  person: {
    id: 'person-id',
    username: 'peter',
    displayName: 'Peter',
    createdAt: new Date(0),
    mustChangePassword: false,
  },
};

describe('default API authentication', () => {
  it.each(['/api', '/api/future-endpoint', '/api/tasks/stream'])('intercepts %s', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each(['/', '/install.sh', '/cli/version.json'])('leaves %s outside the API gate', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });

  it.each([
    ['POST', '/api/auth/setup'],
    ['POST', '/api/auth/login'],
    ['POST', '/api/auth/logout'],
    ['POST', '/api/auth/password'],
    ['GET', '/api/auth/session'],
    ['POST', '/api/auth/cli/start'],
    ['POST', '/api/auth/cli/poll'],
  ])('lets %s %s handle its own session requirements', (method, path) => {
    const response = middleware(new NextRequest(`https://taskyard.test${path}`, { method }));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it.each([
    ['GET', '/api/future-endpoint'],
    ['GET', '/api/auth/login'],
    ['POST', '/api/auth/login/future-endpoint'],
    ['POST', '/api/auth/profile'],
    ['POST', '/api/auth/cli/approve'],
    ['DELETE', '/api/auth/cli/sessions/fixture-id'],
  ])('rejects unauthenticated %s %s by default', (method, path) => {
    const req = new NextRequest(`https://taskyard.test${path}`, {
      method,
      headers: { 'x-taskyard-person-id': session.person.id },
    });
    const response = middleware(req);
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('lets authenticated requests reach an unlisted endpoint', () => {
    const req = new NextRequest('https://taskyard.test/api/future-endpoint', {
      headers: { Authorization: 'Bearer test-token' },
    });
    vi.mocked(personFromToken).mockReturnValueOnce(session);
    const response = middleware(req);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});

describe('task API authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(personFromToken).mockReturnValue(null);
  });

  it.each([
    ['GET', '/api/tasks', tasks.GET],
    ['POST', '/api/tasks', tasks.POST],
    ['GET', '/api/tasks/fixture-id', task.GET],
    ['PATCH', '/api/tasks/fixture-id', task.PATCH],
    ['POST', '/api/tasks/fixture-id/claim', claim.POST],
    ['POST', '/api/tasks/fixture-id/comments', comments.POST],
    ['POST', '/api/tasks/fixture-id/decisions', taskDecisions.POST],
    ['DELETE', '/api/tasks/fixture-id/decisions', taskDecisions.DELETE],
    ['POST', '/api/tasks/fixture-id/dependencies', dependencies.POST],
    ['DELETE', '/api/tasks/fixture-id/dependencies', dependencies.DELETE],
    ['GET', '/api/tasks/next', nextTask.GET],
    ['GET', '/api/tasks/stream', taskStream.GET],
    ['GET', '/api/decisions', decisions.GET],
    ['POST', '/api/decisions/exported', exportDecisions.POST],
    ['GET', '/api/search', search.GET],
    ['GET', '/api/events', events.GET],
    ['GET', '/api/projects', projects.GET],
    ['GET', '/api/threads', threads.GET],
    ['POST', '/api/threads', threads.POST],
    ['GET', '/api/threads/fixture-id', thread.GET],
    ['GET', '/api/threads/fixture-id/events', threadEvents.GET],
  ] as const)('%s %s requires a session', async (method, path, handler) => {
    const req = new Request(`https://taskyard.test${path}`, {
      method,
      headers: { 'x-taskyard-person-id': session.person.id },
    });
    const response = await handler(req, context);
    expect(response.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it.each([
    ['web', { Cookie: 'taskyard_session=test-token' }],
    ['cli', { Authorization: 'Bearer test-token' }],
  ] as const)('accepts a valid %s session', async (kind, headers) => {
    vi.mocked(personFromToken).mockReturnValue({ ...session, kind });

    const response = await tasks.GET(new Request('https://taskyard.test/api/tasks', { headers }));

    expect(response.status).toBe(200);
    expect(personFromToken).toHaveBeenCalledWith(expect.anything(), 'test-token');
    expect(listTasks).toHaveBeenCalledOnce();
  });

  it('rejects an invalid token and a session that needs a password change', async () => {
    const req = new Request('https://taskyard.test/api/tasks', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect((await tasks.GET(req)).status).toBe(401);

    vi.mocked(personFromToken).mockReturnValue({ ...session, mustChangePassword: true });
    expect((await tasks.GET(req)).status).toBe(403);
    expect(listTasks).not.toHaveBeenCalled();
  });
});
