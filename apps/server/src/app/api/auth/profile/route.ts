import { changeDisplayName, getDb } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { peopleErrorResponse, requireFullSession } from '@/lib/people-api';
import { personJson } from '@/lib/web-session';

export async function PATCH(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;

  let body: { display_name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON');
  }
  if (typeof body.display_name !== 'string') return jsonError('display_name is required');

  try {
    const person = changeDisplayName(getDb(), gate.person.id, body.display_name);
    return jsonOk({ person: personJson(person) });
  } catch (err) {
    return peopleErrorResponse(err, 'Failed to change the display name');
  }
}
