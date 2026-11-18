import { projectTasksSse } from '@/lib/sse';
import { jsonError } from '@/lib/api-response';
import { requireFullSession } from '@/lib/people-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;

  const projectId = new URL(req.url).searchParams.get('project_id')?.trim();
  if (!projectId) return jsonError('project_id is required', 400);
  return projectTasksSse(projectId);
}
