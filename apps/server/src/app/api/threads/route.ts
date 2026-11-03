import type { CreateThreadRequest, ThreadState } from '@taskyard/protocol';
import {
  createThread,
  getDb,
  IdeaError,
  listThreads,
  NoMachineAvailableError,
  PlacementError,
  ProjectError,
  TaskError,
} from '@taskyard/core';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireIdeaPerson } from '@/lib/ideas-api';

export async function GET(req: Request) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  const db = getDb();
  const status = new URL(req.url).searchParams.get('status') as ThreadState | null;
  const threads = listThreads(db, status ?? undefined, gate.person.id);
  return jsonOk({ threads });
}

export async function POST(req: Request) {
  let body: CreateThreadRequest;
  try {
    body = (await req.json()) as CreateThreadRequest;
  } catch {
    return jsonError('Invalid JSON');
  }

  if ((!body.project_id && !body.idea_id) || !body.agent_type) {
    return jsonError('project_id or idea_id and agent_type are required');
  }
  if (!body.prompt?.trim() && !body.task_id && !body.idea_id) {
    return jsonError('prompt, task_id, or idea_id is required');
  }

  let personId: string | undefined;
  if (body.idea_id) {
    const gate = requireIdeaPerson(req);
    if (!gate.ok) return gate.response;
    personId = gate.person.id;
  }

  const db = getDb();
  try {
    const thread = await createThread(db, body, personId);
    return jsonOk({ thread }, 201);
  } catch (err) {
    if (err instanceof PlacementError) {
      return jsonError(err.message, 503, { code: err.code, hint: err.hint });
    }
    if (err instanceof NoMachineAvailableError) {
      return jsonError(err.message, 503, { code: 'NO_MACHINE_AVAILABLE' });
    }
    if (err instanceof ProjectError) {
      return jsonError(err.message, 400, { code: 'PROJECT_ERROR' });
    }
    if (err instanceof TaskError) {
      return jsonError(err.message, 400, { code: 'TASK_ERROR' });
    }
    if (err instanceof IdeaError) {
      return jsonError(err.message, err.statusCode, { code: 'IDEA_ERROR' });
    }
    return jsonError(err instanceof Error ? err.message : 'Failed to create thread', 500);
  }
}
