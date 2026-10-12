import { getDb, personFromToken } from '@taskyard/core';
import { jsonOk } from '@/lib/api-response';
import { personJson, sessionTokenFromRequest } from '@/lib/web-session';

export async function GET(req: Request) {
  const token = sessionTokenFromRequest(req);
  if (!token) return jsonOk({ person: null });
  const session = personFromToken(getDb(), token);
  if (!session) return jsonOk({ person: null });
  return jsonOk({
    person: {
      ...personJson(session.person),
      must_change_password: session.mustChangePassword,
    },
  });
}
