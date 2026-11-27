import { getDb, revokeCliSession } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireFullSession } from '@/lib/people-api';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  if (gate.kind !== 'web') return jsonError('Sign in in the browser to manage terminal sessions.', 403);
  const { id } = await params;
  revokeCliSession(getDb(), gate.person.id, id);
  return jsonOk({ ok: true });
}
