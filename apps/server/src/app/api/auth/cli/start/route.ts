import { getDb, startCliLogin } from '@taskyard/core';
import { jsonOk } from '@/lib/api-response';

export async function POST() {
  return jsonOk(startCliLogin(getDb()), 201);
}
