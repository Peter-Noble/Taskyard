import { createPerson, getDb, listPeople } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { peopleErrorResponse, requireFullSession } from '@/lib/people-api';
import { personJson } from '@/lib/web-session';

export async function GET(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  return jsonOk({ people: listPeople(getDb()).map(personJson) });
}

export async function POST(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;

  let body: { username?: string; display_name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError('Invalid JSON');
  }
  if (typeof body.username !== 'string' || typeof body.display_name !== 'string') {
    return jsonError('username and display_name are required');
  }

  try {
    const created = await createPerson(getDb(), {
      username: body.username,
      displayName: body.display_name,
    });
    return jsonOk(
      { person: personJson(created.person), temporary_password: created.temporaryPassword },
      201,
    );
  } catch (err) {
    return peopleErrorResponse(err, 'Failed to create the person');
  }
}
