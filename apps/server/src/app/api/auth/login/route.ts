import { authenticate, createSession, getDb } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { peopleErrorResponse } from '@/lib/people-api';
import { personJson, setSessionCookie } from '@/lib/web-session';

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON');
  }
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    return jsonError('username and password are required');
  }

  const db = getDb();
  try {
    const result = await authenticate(db, body.username, body.password);
    if (!result) return jsonError('Username or password is wrong.', 401);
    const session = createSession(db, result.person.id, {
      kind: 'web',
      mustChangePassword: result.passwordChangeRequired,
    });
    const res = jsonOk({
      person: personJson({
        ...result.person,
        mustChangePassword: result.passwordChangeRequired,
      }),
    });
    setSessionCookie(res, session.token, req);
    return res;
  } catch (err) {
    return peopleErrorResponse(err, 'Failed to sign in');
  }
}
