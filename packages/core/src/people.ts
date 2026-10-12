import { people, sessions, type TaskyardDb } from '@taskyard/db';
import { asc, count, eq } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { generateTemporaryPassword, hashPassword, verifyPassword } from './passwords.js';

export class PeopleError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PeopleError';
    this.statusCode = statusCode;
  }
}

export type PersonRecord = {
  id: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
  createdAt: Date;
};

export type WebSession = {
  person: PersonRecord;
  sessionId: string;
  kind: 'web' | 'cli';
  mustChangePassword: boolean;
};

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/;

function toPerson(row: typeof people.$inferSelect): PersonRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt ?? new Date(0),
  };
}

export function normalizeUsername(raw: string): string {
  const username = raw.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) {
    throw new PeopleError(
      'Username must be 1–32 characters and use letters, numbers, dots, hyphens, or underscores.',
    );
  }
  return username;
}

export function normalizeDisplayName(raw: string): string {
  const displayName = raw.trim().replace(/\s+/g, ' ');
  if (!displayName || displayName.length > 80) {
    throw new PeopleError('Display name must be 1–80 characters.');
  }
  if (/[\u0000-\u001F]/.test(displayName)) {
    throw new PeopleError('Display name cannot include control characters.');
  }
  return displayName;
}

function assertChosenPassword(password: string): string {
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    throw new PeopleError('Password must be at least 8 characters.');
  }
  return password;
}

function requireRow(db: TaskyardDb, personId: string): typeof people.$inferSelect {
  const row = db.select().from(people).where(eq(people.id, personId)).get();
  if (!row) throw new PeopleError('Person not found.', 404);
  return row;
}

function assertUsernameFree(db: TaskyardDb, username: string) {
  const existing = db.select({ id: people.id }).from(people).where(eq(people.username, username)).get();
  if (existing) throw new PeopleError('That username is taken.', 409);
}

export function countPeople(db: TaskyardDb): number {
  const row = db.select({ n: count() }).from(people).get();
  return row?.n ?? 0;
}

export function listPeople(db: TaskyardDb): PersonRecord[] {
  return db.select().from(people).orderBy(asc(people.createdAt), asc(people.username)).all().map(toPerson);
}

export function getPerson(db: TaskyardDb, personId: string): PersonRecord | null {
  const row = db.select().from(people).where(eq(people.id, personId)).get();
  return row ? toPerson(row) : null;
}

export async function createFirstPerson(
  db: TaskyardDb,
  input: { username: string; displayName: string; password: string },
): Promise<PersonRecord> {
  const username = normalizeUsername(input.username);
  const displayName = normalizeDisplayName(input.displayName);
  const password = assertChosenPassword(input.password);
  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const createdAt = new Date();

  db.transaction((tx) => {
    const existing = tx.select({ n: count() }).from(people).get();
    if ((existing?.n ?? 0) > 0) throw new PeopleError('An account already exists.', 409);
    assertUsernameFree(tx, username);
    tx.insert(people)
      .values({
        id,
        username,
        displayName,
        passwordHash,
        mustChangePassword: false,
        createdAt,
      })
      .run();
  });

  return {
    id,
    username,
    displayName,
    mustChangePassword: false,
    createdAt,
  };
}

export async function createPerson(
  db: TaskyardDb,
  input: { username: string; displayName: string },
): Promise<{ person: PersonRecord; temporaryPassword: string }> {
  const username = normalizeUsername(input.username);
  const displayName = normalizeDisplayName(input.displayName);
  assertUsernameFree(db, username);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const id = randomUUID();
  const createdAt = new Date();
  db.insert(people)
    .values({
      id,
      username,
      displayName,
      passwordHash,
      mustChangePassword: true,
      createdAt,
    })
    .run();
  return {
    person: { id, username, displayName, mustChangePassword: true, createdAt },
    temporaryPassword,
  };
}

export function markPasswordReset(db: TaskyardDb, personId: string): PersonRecord {
  const row = requireRow(db, personId);
  // A reset waits for the next sign-in. This session stays usable. D-004
  db.update(people).set({ mustChangePassword: true }).where(eq(people.id, row.id)).run();
  return { ...toPerson(row), mustChangePassword: true };
}

export async function issueTemporaryPassword(
  db: TaskyardDb,
  personId: string,
): Promise<{ person: PersonRecord; temporaryPassword: string }> {
  const row = requireRow(db, personId);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  // Replacing the password ends existing sessions. D-004
  db.transaction((tx) => {
    tx.update(people)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(people.id, row.id))
      .run();
    tx.delete(sessions).where(eq(sessions.personId, row.id)).run();
  });
  return {
    person: { ...toPerson(row), mustChangePassword: true },
    temporaryPassword,
  };
}

export function changeDisplayName(db: TaskyardDb, personId: string, displayNameRaw: string): PersonRecord {
  const row = requireRow(db, personId);
  const displayName = normalizeDisplayName(displayNameRaw);
  db.update(people).set({ displayName }).where(eq(people.id, row.id)).run();
  return { ...toPerson(row), displayName };
}

export async function changeOwnPassword(
  db: TaskyardDb,
  personId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const row = requireRow(db, personId);
  const matches = await verifyPassword(currentPassword, row.passwordHash);
  if (!matches) throw new PeopleError('Current password is wrong.', 403);
  const password = assertChosenPassword(newPassword);
  const passwordHash = await hashPassword(password);
  db.update(people)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(people.id, row.id))
    .run();
  db.update(sessions).set({ mustChangePassword: false }).where(eq(sessions.personId, row.id)).run();
}

export async function setRequiredPassword(db: TaskyardDb, personId: string, newPassword: string): Promise<void> {
  const row = requireRow(db, personId);
  const password = assertChosenPassword(newPassword);
  const passwordHash = await hashPassword(password);
  db.transaction((tx) => {
    tx.update(people)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(people.id, row.id))
      .run();
    tx.update(sessions).set({ mustChangePassword: false }).where(eq(sessions.personId, row.id)).run();
  });
}

export async function authenticate(
  db: TaskyardDb,
  usernameRaw: string,
  password: string,
): Promise<{ person: PersonRecord; passwordChangeRequired: boolean } | null> {
  const username = usernameRaw.trim().toLowerCase();
  if (!username || typeof password !== 'string' || !password) return null;
  const row = db.select().from(people).where(eq(people.username, username)).get();
  if (!row) return null;
  const matches = await verifyPassword(password, row.passwordHash);
  if (!matches) return null;
  return { person: toPerson(row), passwordChangeRequired: row.mustChangePassword };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(
  db: TaskyardDb,
  personId: string,
  opts: { kind: 'web' | 'cli'; mustChangePassword: boolean },
): { id: string; token: string } {
  requireRow(db, personId);
  const token = randomBytes(32).toString('base64url');
  const id = randomUUID();
  db.insert(sessions)
    .values({
      id,
      personId,
      tokenHash: hashSessionToken(token),
      kind: opts.kind,
      mustChangePassword: opts.mustChangePassword,
      createdAt: new Date(),
    })
    .run();
  return { id, token };
}

export function deleteSessionByToken(db: TaskyardDb, token: string): void {
  if (!token) return;
  db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token))).run();
}

export function personFromToken(db: TaskyardDb, token: string): WebSession | null {
  if (!token) return null;
  const session = db.select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token))).get();
  if (!session) return null;
  const row = db.select().from(people).where(eq(people.id, session.personId)).get();
  if (!row) return null;
  return {
    person: toPerson(row),
    sessionId: session.id,
    kind: session.kind,
    mustChangePassword: session.mustChangePassword,
  };
}
