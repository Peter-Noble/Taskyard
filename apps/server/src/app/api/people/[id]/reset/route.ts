import { getDb, markPasswordReset } from '@taskyard/core';
import { jsonOk } from '@/lib/api-response';
import { peopleErrorResponse, requireFullSession } from '@/lib/people-api';
import { personJson } from '@/lib/web-session';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    const person = markPasswordReset(getDb(), id);
    return jsonOk({ person: personJson(person) });
  } catch (err) {
    return peopleErrorResponse(err, 'Failed to mark the password reset');
  }
}
