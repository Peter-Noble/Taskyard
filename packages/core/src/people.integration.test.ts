import { describe, expect, it } from 'vitest';
import { createTestDb } from '@taskyard/test-utils';
import { addTaskComment, createTask } from './tasks.js';
import { createProject } from './projects.js';
import {
  authenticate,
  changeDisplayName,
  changeOwnPassword,
  createFirstPerson,
  createPerson,
  createSession,
  issueTemporaryPassword,
  markPasswordReset,
  PeopleError,
  personFromToken,
  setRequiredPassword,
} from './people.js';

function storedHash(sqlite: { prepare: (sql: string) => { get: (...args: unknown[]) => { password_hash: string } } }, id: string) {
  return sqlite.prepare('SELECT password_hash FROM people WHERE id = ?').get(id).password_hash;
}

describe('people and sessions', () => {
  it('creates the first person with a hash, then a second person who must set a password', async () => {
    const ctx = createTestDb();
    try {
      const first = await createFirstPerson(ctx.db, {
        username: 'Peter',
        displayName: 'Peter',
        password: 'first-password',
      });
      expect(first.username).toBe('peter');
      expect(first.mustChangePassword).toBe(false);
      const firstHash = storedHash(ctx.sqlite, first.id);
      expect(firstHash.startsWith('scrypt$')).toBe(true);
      expect(firstHash).not.toContain('first-password');

      await expect(
        createFirstPerson(ctx.db, {
          username: 'other',
          displayName: 'Other',
          password: 'another-password',
        }),
      ).rejects.toBeInstanceOf(PeopleError);

      const created = await createPerson(ctx.db, { username: 'sam', displayName: 'Sam' });
      expect(created.person.mustChangePassword).toBe(true);
      expect(created.temporaryPassword).not.toBe(storedHash(ctx.sqlite, created.person.id));
      expect(storedHash(ctx.sqlite, created.person.id)).not.toContain(created.temporaryPassword);

      const signedIn = await authenticate(ctx.db, 'Sam', created.temporaryPassword);
      expect(signedIn?.passwordChangeRequired).toBe(true);
      const session = createSession(ctx.db, created.person.id, {
        kind: 'web',
        mustChangePassword: true,
      });
      expect(personFromToken(ctx.db, session.token)?.mustChangePassword).toBe(true);

      await setRequiredPassword(ctx.db, created.person.id, 'sam-new-password');
      expect(personFromToken(ctx.db, session.token)?.mustChangePassword).toBe(false);
      expect(await authenticate(ctx.db, 'sam', created.temporaryPassword)).toBeNull();
      expect((await authenticate(ctx.db, 'sam', 'sam-new-password'))?.person.displayName).toBe('Sam');
    } finally {
      ctx.cleanup();
    }
  });

  it('keeps the current session when marking a reset, and ends sessions when issuing a temporary password', async () => {
    const ctx = createTestDb();
    try {
      const first = await createFirstPerson(ctx.db, {
        username: 'peter',
        displayName: 'Peter',
        password: 'first-password',
      });
      const session = createSession(ctx.db, first.id, { kind: 'web', mustChangePassword: false });
      const hashBefore = storedHash(ctx.sqlite, first.id);

      markPasswordReset(ctx.db, first.id);
      expect(storedHash(ctx.sqlite, first.id)).toBe(hashBefore);
      expect(personFromToken(ctx.db, session.token)?.mustChangePassword).toBe(false);
      expect((await authenticate(ctx.db, 'peter', 'first-password'))?.passwordChangeRequired).toBe(true);

      const replacement = createSession(ctx.db, first.id, { kind: 'web', mustChangePassword: false });
      const issued = await issueTemporaryPassword(ctx.db, first.id);
      expect(storedHash(ctx.sqlite, first.id)).not.toBe(hashBefore);
      expect(personFromToken(ctx.db, session.token)).toBeNull();
      expect(personFromToken(ctx.db, replacement.token)).toBeNull();
      expect(await authenticate(ctx.db, 'peter', 'first-password')).toBeNull();
      expect((await authenticate(ctx.db, 'peter', issued.temporaryPassword))?.passwordChangeRequired).toBe(true);
    } finally {
      ctx.cleanup();
    }
  });

  it('changes a display name freely and a password only with the current one', async () => {
    const ctx = createTestDb();
    try {
      const first = await createFirstPerson(ctx.db, {
        username: 'peter',
        displayName: 'Peter',
        password: 'first-password',
      });
      expect(changeDisplayName(ctx.db, first.id, 'Peter Smith').displayName).toBe('Peter Smith');
      await expect(changeOwnPassword(ctx.db, first.id, 'nope-nope', 'next-password')).rejects.toMatchObject({
        statusCode: 403,
      });
      await changeOwnPassword(ctx.db, first.id, 'first-password', 'next-password');
      expect(await authenticate(ctx.db, 'peter', 'first-password')).toBeNull();
      expect(await authenticate(ctx.db, 'peter', 'next-password')).not.toBeNull();

      const project = createProject(ctx.db, { name: 'Taskyard' });
      const task = createTask(ctx.db, { project_id: project.id, title: 'Note' });
      const activity = addTaskComment(ctx.db, task.id, { text: 'Hello', actor: 'Peter Smith' });
      expect(activity?.actor).toBe('Peter Smith');
    } finally {
      ctx.cleanup();
    }
  });
});
