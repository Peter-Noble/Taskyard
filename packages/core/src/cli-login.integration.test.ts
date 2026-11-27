import { createTestDb } from '@taskyard/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { approveCliLogin, pollCliLogin, startCliLogin } from './cli-login.js';
import { createFirstPerson, createSession, listCliSessions, personFromToken, revokeCliSession, setRequiredPassword } from './people.js';

describe('terminal sign-in', () => {
  it('requires browser approval and redeems the secret once for a revocable CLI session', async () => {
    const ctx = createTestDb();
    try {
      const person = await createFirstPerson(ctx.db, { username: 'peter', displayName: 'Peter', password: 'first-password' });
      const web = createSession(ctx.db, person.id, { kind: 'web', mustChangePassword: false });
      const restricted = createSession(ctx.db, person.id, { kind: 'web', mustChangePassword: true });
      const request = startCliLogin(ctx.db);

      expect(pollCliLogin(ctx.db, request.secret)).toEqual({ status: 'pending' });
      expect(() => pollCliLogin(ctx.db, request.code)).toThrow(expect.objectContaining({ statusCode: 410 }));
      expect(() => approveCliLogin(ctx.db, '', request.code)).toThrow(expect.objectContaining({ statusCode: 401 }));
      expect(() => approveCliLogin(ctx.db, restricted.token, request.code)).toThrow(expect.objectContaining({ statusCode: 403 }));
      await setRequiredPassword(ctx.db, person.id, 'second-password');
      approveCliLogin(ctx.db, restricted.token, request.code.toLowerCase());
      expect(() => approveCliLogin(ctx.db, web.token, request.code)).toThrow(expect.objectContaining({ statusCode: 404 }));

      const result = pollCliLogin(ctx.db, request.secret);
      if (result.status !== 'approved') throw new Error('Expected an approved terminal');
      expect(personFromToken(ctx.db, result.token)).toMatchObject({ kind: 'cli', person: { id: person.id } });
      expect(() => pollCliLogin(ctx.db, request.secret)).toThrow(expect.objectContaining({ statusCode: 410 }));
      const another = startCliLogin(ctx.db);
      expect(() => approveCliLogin(ctx.db, result.token, another.code)).toThrow(expect.objectContaining({ statusCode: 401 }));

      const [cliSession] = listCliSessions(ctx.db, person.id);
      revokeCliSession(ctx.db, 'another-person', cliSession.id);
      expect(personFromToken(ctx.db, result.token)).not.toBeNull();
      revokeCliSession(ctx.db, person.id, cliSession.id);
      expect(personFromToken(ctx.db, result.token)).toBeNull();
      expect(personFromToken(ctx.db, web.token)).not.toBeNull();
    } finally {
      ctx.cleanup();
    }
  });

  it('expires codes and terminal sessions independently of browser sessions', async () => {
    const ctx = createTestDb();
    try {
      const person = await createFirstPerson(ctx.db, { username: 'peter', displayName: 'Peter', password: 'first-password' });
      const now = Date.now();
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(now);
      const web = createSession(ctx.db, person.id, { kind: 'web', mustChangePassword: false });
      const cli = createSession(ctx.db, person.id, { kind: 'cli', mustChangePassword: false });
      const request = startCliLogin(ctx.db);

      vi.setSystemTime(now + request.expires_in * 1000);
      expect(() => approveCliLogin(ctx.db, web.token, request.code)).toThrow(expect.objectContaining({ statusCode: 404 }));
      expect(() => pollCliLogin(ctx.db, request.secret)).toThrow(expect.objectContaining({ statusCode: 410 }));
      expect(personFromToken(ctx.db, cli.token)).not.toBeNull();

      vi.setSystemTime(now + 30 * 24 * 60 * 60 * 1000);
      expect(personFromToken(ctx.db, cli.token)).toBeNull();
      expect(listCliSessions(ctx.db, person.id)).toEqual([]);
      expect(personFromToken(ctx.db, web.token)).not.toBeNull();
    } finally {
      vi.useRealTimers();
      ctx.cleanup();
    }
  });
});
