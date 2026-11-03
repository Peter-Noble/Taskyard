import type { NextResponse } from 'next/server';
import type { ThreadDetail } from '@taskyard/protocol';
import { canReadThread, getDb, getIdeaDetail, getThreadDetail } from '@taskyard/core';
import { jsonError } from '@/lib/api-response';
import { requireIdeaPerson } from '@/lib/ideas-api';

type ThreadAccess =
  | { ok: true; thread: ThreadDetail; personId?: string }
  | { ok: false; response: NextResponse };

export function requireThreadRead(req: Request, id: string): ThreadAccess {
  const thread = getThreadDetail(getDb(), id);
  if (!thread) return { ok: false, response: jsonError('Thread not found', 404) };
  if (!thread.idea_id) return { ok: true, thread };
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate;
  if (!canReadThread(getDb(), id, gate.person.id)) {
    return { ok: false, response: jsonError('Thread not found', 404) };
  }
  return { ok: true, thread, personId: gate.person.id };
}

export function requireThreadWrite(req: Request, id: string): ThreadAccess {
  const access = requireThreadRead(req, id);
  if (!access.ok || !access.thread.idea_id) return access;
  const idea = getIdeaDetail(getDb(), access.thread.idea_id, access.personId!);
  if (!idea || idea.owner_id !== access.personId) {
    return { ok: false, response: jsonError('Thread not found', 404) };
  }
  return access;
}
