import { NextResponse } from 'next/server';
import { countPeople, getDb, personFromToken, type PersonRecord } from '@taskyard/core';

export const SESSION_COOKIE = 'taskyard_session';

export type SessionPerson = {
  id: string;
  username: string;
  displayName: string;
};

export type WebGate =
  | { kind: 'setup' }
  | { kind: 'login' }
  | { kind: 'change-password'; username: string; displayName: string }
  | { kind: 'app'; person: SessionPerson };

export function sessionTokenFromRequest(req: Request): string | undefined {
  const header = req.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

export function readWebGate(token: string | undefined): WebGate {
  const db = getDb();
  if (countPeople(db) === 0) return { kind: 'setup' };
  if (!token) return { kind: 'login' };
  const session = personFromToken(db, token);
  if (!session) return { kind: 'login' };
  if (session.mustChangePassword) {
    return {
      kind: 'change-password',
      username: session.person.username,
      displayName: session.person.displayName,
    };
  }
  return {
    kind: 'app',
    person: {
      id: session.person.id,
      username: session.person.username,
      displayName: session.person.displayName,
    },
  };
}

export function setSessionCookie(res: NextResponse, token: string, req: Request) {
  const secure = new URL(req.url).protocol === 'https:';
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function personJson(person: PersonRecord) {
  return {
    id: person.id,
    username: person.username,
    display_name: person.displayName,
    must_change_password: person.mustChangePassword,
    created_at: person.createdAt.toISOString(),
  };
}
