import { deleteSessionByToken, getDb } from '@taskyard/core';
import { jsonOk } from '@/lib/api-response';
import { clearSessionCookie, sessionTokenFromRequest } from '@/lib/web-session';

export async function POST(req: Request) {
  const token = sessionTokenFromRequest(req);
  if (token) deleteSessionByToken(getDb(), token);
  const res = jsonOk({ ok: true });
  clearSessionCookie(res);
  return res;
}
