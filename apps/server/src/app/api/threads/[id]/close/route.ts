import { getDb, closeThread } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  try {
    const thread = await closeThread(db, id);
    if (!thread) return jsonError('Thread not found', 404);
    return jsonOk({ thread });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Close failed', 400);
  }
}
