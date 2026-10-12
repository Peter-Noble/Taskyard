import { changeOwnPassword, getDb, personFromToken, setRequiredPassword } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { peopleErrorResponse } from '@/lib/people-api';
import { sessionTokenFromRequest } from '@/lib/web-session';

export async function POST(req: Request) {
  const token = sessionTokenFromRequest(req);
  if (!token) return jsonError('Sign in required.', 401);
  const db = getDb();
  const session = personFromToken(db, token);
  if (!session) return jsonError('Sign in required.', 401);

  let body: { current_password?: string; new_password?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON');
  }
  if (typeof body.new_password !== 'string') return jsonError('new_password is required');

  try {
    if (session.mustChangePassword) {
      await setRequiredPassword(db, session.person.id, body.new_password);
    } else {
      if (typeof body.current_password !== 'string') return jsonError('current_password is required');
      await changeOwnPassword(db, session.person.id, body.current_password, body.new_password);
    }
    return jsonOk({ ok: true });
  } catch (err) {
    return peopleErrorResponse(err, 'Failed to change the password');
  }
}
