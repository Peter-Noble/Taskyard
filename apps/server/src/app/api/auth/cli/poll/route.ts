import { getDb, pollCliLogin } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { peopleErrorResponse } from '@/lib/people-api';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { secret?: unknown } | null;
  if (typeof body?.secret !== 'string') return jsonError('A sign-in request secret is required.');
  try {
    return jsonOk(pollCliLogin(getDb(), body.secret));
  } catch (err) {
    return peopleErrorResponse(err, 'Could not check terminal sign-in.');
  }
}
