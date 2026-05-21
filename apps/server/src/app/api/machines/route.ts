import { getDb, listMachines } from '@taskyard/core';
import { jsonOk } from '@/lib/api-response';

export async function GET() {
  const db = getDb();
  return jsonOk({ machines: listMachines(db) });
}
