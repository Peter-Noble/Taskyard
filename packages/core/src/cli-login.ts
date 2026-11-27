import { cliLoginRequests, people, sessions, type TaskyardDb } from '@taskyard/db';
import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { randomBytes, randomInt } from 'node:crypto';
import { createSession, hashSessionToken, PeopleError, personFromToken } from './people.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{10}$/;
const LOGIN_LIFETIME_SECONDS = 10 * 60;

export function startCliLogin(db: TaskyardDb) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOGIN_LIFETIME_SECONDS * 1000);
  const secret = randomBytes(32).toString('base64url');
  const secretHash = hashSessionToken(secret);
  db.delete(cliLoginRequests).where(lte(cliLoginRequests.expiresAt, now)).run();

  for (;;) {
    const code = Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    const result = db.insert(cliLoginRequests)
      .values({ secretHash, codeHash: hashSessionToken(code), expiresAt })
      .onConflictDoNothing({ target: cliLoginRequests.codeHash }).run();
    if (result.changes) {
      return { code: `${code.slice(0, 5)}-${code.slice(5)}`, secret, expires_in: LOGIN_LIFETIME_SECONDS, interval: 5 };
    }
  }
}

export function approveCliLogin(db: TaskyardDb, browserToken: string, inputCode: string): void {
  const code = inputCode.replace(/[\s-]/g, '').toUpperCase();
  if (!CODE_PATTERN.test(code)) throw new PeopleError('Enter the 10-character code from your terminal.');

  db.transaction((tx) => {
    const web = personFromToken(tx, browserToken);
    if (!web || web.kind !== 'web') throw new PeopleError('Sign in in the browser to approve a terminal.', 401);
    if (web.mustChangePassword || web.person.mustChangePassword) {
      throw new PeopleError('Sign out and sign in again to set a new password before approving a terminal.', 403);
    }

    const result = tx.update(cliLoginRequests).set({ approvedBy: web.sessionId }).where(and(
      eq(cliLoginRequests.codeHash, hashSessionToken(code)),
      gt(cliLoginRequests.expiresAt, new Date()),
      isNull(cliLoginRequests.approvedBy),
    )).run();
    if (!result.changes) throw new PeopleError('This code is invalid, expired, or already used.', 404);
  }, { behavior: 'immediate' });
}

export function pollCliLogin(db: TaskyardDb, secret: string) {
  const expired = () => new PeopleError('This sign-in request has expired or was already used. Run taskyard login again.', 410);
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw expired();

  return db.transaction((tx) => {
    const secretHash = hashSessionToken(secret);
    const request = tx.select().from(cliLoginRequests).where(and(
      eq(cliLoginRequests.secretHash, secretHash),
      gt(cliLoginRequests.expiresAt, new Date()),
    )).get();
    if (!request) throw expired();
    if (!request.approvedBy) return { status: 'pending' as const };

    const approver = tx.select({ personId: people.id, username: people.username }).from(sessions)
      .innerJoin(people, eq(people.id, sessions.personId)).where(and(
        eq(sessions.id, request.approvedBy),
        eq(sessions.kind, 'web'),
        eq(sessions.mustChangePassword, false),
        eq(people.mustChangePassword, false),
      )).get();
    if (!approver) throw new PeopleError('Browser approval is no longer valid. Run taskyard login again.', 403);

    const session = createSession(tx, approver.personId, { kind: 'cli', mustChangePassword: false });
    tx.delete(cliLoginRequests).where(eq(cliLoginRequests.secretHash, secretHash)).run();
    return { status: 'approved' as const, token: session.token, username: approver.username };
  }, { behavior: 'immediate' });
}
