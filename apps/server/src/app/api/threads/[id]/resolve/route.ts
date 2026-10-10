import { getDb, resolveThreadPrompt } from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };

type ResolveBody = {
  request_id?: string;
  kind?: string;
  answers?: Array<{ question_id?: string; answer?: string | string[] }>;
  approved?: boolean;
  feedback?: string;
  result?: unknown;
};

/** Map UI resolve payloads to ACP JSON-RPC result shapes expected by the worker. */
function toAcpResult(body: ResolveBody): unknown {
  if (body.result !== undefined) return body.result;

  if (body.kind === 'plan') {
    if (body.approved) {
      return { outcome: { outcome: 'accepted' } };
    }
    return {
      outcome: {
        outcome: 'rejected',
        reason: typeof body.feedback === 'string' ? body.feedback : undefined,
      },
    };
  }

  if (body.kind === 'question') {
    const answers = (body.answers ?? []).map((a) => {
      const selected = Array.isArray(a.answer) ? a.answer : a.answer != null ? [String(a.answer)] : [];
      return {
        questionId: a.question_id ?? '',
        selectedOptionIds: selected,
      };
    });
    return { outcome: { outcome: 'answered', answers } };
  }

  return body;
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  let body: ResolveBody;
  try {
    body = (await req.json()) as ResolveBody;
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  if (typeof body.request_id !== 'string' || !body.request_id) {
    return jsonError('request_id is required', 400);
  }

  const db = getDb();
  try {
    const result = await resolveThreadPrompt(db, id, body.request_id, toAcpResult(body));
    if (!result) return jsonError('Thread not found', 404);
    return jsonOk(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Resolve failed', 400);
  }
}
