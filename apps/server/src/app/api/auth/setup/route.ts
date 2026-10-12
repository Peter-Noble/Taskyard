import {
  createFirstPerson,
  createSession,
  getDb,
} from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { peopleErrorResponse } from '@/lib/people-api';
import { personJson, setSessionCookie } from '@/lib/web-session';

export async function POST(req: Request) {
  let body: { username?: string; display_name?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON');
  }
  if (typeof body.username !== 'string' || typeof body.display_name !== 'string' || typeof body.password !== 'string') {
    return jsonError('username, display_name, and password are required');
  }

  const db = getDb();
  try {
    const person = await createFirstPerson(db, {
      username: body.username,
      displayName: body.display_name,
      password: body.password,
    });
    const session = createSession(db, person.id, { kind: 'web', mustChangePassword: false });
    const res = jsonOk({ person: personJson(person) }, 201);
    setSessionCookie(res, session.token, req);
    return res;
  } catch (err) {
    return peopleErrorResponse(err, 'Failed to create the account');
  }
}
