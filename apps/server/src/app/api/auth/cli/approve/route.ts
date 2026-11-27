import { approveCliLogin, getDb } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { peopleErrorResponse } from '@/lib/people-api';
import { sessionTokenFromRequest } from '@/lib/web-session';

export async function POST(req: Request) {
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return jsonError('Expected JSON.', 415);
  }
  const token = sessionTokenFromRequest(req);
  if (!token) return jsonError('Sign in required.', 401);
  const body = await req.json().catch(() => null) as { code?: unknown } | null;
  if (typeof body?.code !== 'string' || body.code.length > 64) return jsonError('A terminal code is required.');
  try {
    approveCliLogin(getDb(), token, body.code);
    return jsonOk({ ok: true });
  } catch (err) {
    return peopleErrorResponse(err, 'Could not approve terminal sign-in.');
  }
}
