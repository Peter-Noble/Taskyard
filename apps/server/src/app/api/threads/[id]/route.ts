import { getDb, getThreadDetail } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const thread = getThreadDetail(db, id);
  if (!thread) return jsonError('Thread not found', 404);
  return jsonOk({ thread });
}
