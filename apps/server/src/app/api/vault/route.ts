import { getDb, listVault, setVaultKeys, deleteVaultKey } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

export async function GET(req: Request) {
  const db = getDb();
  const agentType = new URL(req.url).searchParams.get('agent_type') ?? undefined;
  return jsonOk({ keys: listVault(db, agentType) });
}

export async function PUT(req: Request) {
  let body: { agent_type?: string; keys?: Record<string, string> };
  try {
    body = (await req.json()) as { agent_type?: string; keys?: Record<string, string> };
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!body.agent_type || !body.keys || typeof body.keys !== 'object') {
    return jsonError('agent_type and keys are required');
  }

  const db = getDb();
  setVaultKeys(db, body.agent_type, body.keys);
  return jsonOk({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return jsonError('id query parameter required');

  const db = getDb();
  const deleted = deleteVaultKey(db, id);
  if (!deleted) return jsonError('Key not found', 404);
  return jsonOk({ ok: true });
}
