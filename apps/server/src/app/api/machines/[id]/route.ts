import type { UpdateMachineRequest } from '@taskyard/protocol';
import { getDb, updateMachinePolicy } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  let body: UpdateMachineRequest;
  try {
    body = (await req.json()) as UpdateMachineRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  const db = getDb();
  const machine = updateMachinePolicy(db, id, body);
  if (!machine) return jsonError('Machine not found', 404);
  return jsonOk({ machine });
}
