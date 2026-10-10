import { followUpThread, getDb } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  let body: { prompt?: string };
  try {
    body = (await req.json()) as { prompt?: string };
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  if (typeof body.prompt !== 'string') {
    return jsonError('prompt is required', 400);
  }

  const db = getDb();
  try {
    const result = await followUpThread(db, id, body.prompt);
    if (!result) return jsonError('Thread not found', 404);
    return jsonOk(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Follow-up failed', 400);
  }
}
