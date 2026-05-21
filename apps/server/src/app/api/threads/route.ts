import type { CreateThreadRequest, ThreadState } from '@taskyard/protocol';
import {
  createThread,
  getDb,
  listThreads,
  NoMachineAvailableError,
  PortExhaustedError,
} from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';

export async function GET(req: Request) {
  const db = getDb();
  const status = new URL(req.url).searchParams.get('status') as ThreadState | null;
  const threads = listThreads(db, status ?? undefined);
  return jsonOk({ threads });
}

export async function POST(req: Request) {
  let body: CreateThreadRequest;
  try {
    body = (await req.json()) as CreateThreadRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if (!body.project_id || !body.agent_type || !body.prompt) {
    return jsonError('project_id, agent_type, and prompt are required');
  }

  const db = getDb();
  try {
    const thread = await createThread(db, {
      project_id: body.project_id,
      agent_type: body.agent_type,
      branch: body.branch ?? 'main',
      prompt: body.prompt,
      machine_id: body.machine_id,
    });
    return jsonOk({ thread }, 201);
  } catch (err) {
    if (err instanceof NoMachineAvailableError) {
      return jsonError(err.message, 503);
    }
    if (err instanceof PortExhaustedError) {
      return jsonError(err.message, 503);
    }
    return jsonError(err instanceof Error ? err.message : 'Failed to create thread', 500);
  }
}
