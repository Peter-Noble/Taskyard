import { getDb, closeThread } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireThreadWrite } from '@/lib/thread-access';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const access = requireThreadWrite(req, id);
  if (!access.ok) return access.response;
  const db = getDb();
  try {
    const thread = await closeThread(db, id);
    if (!thread) return jsonError('Thread not found', 404);
    return jsonOk({ thread });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Close failed', 400);
  }
}
