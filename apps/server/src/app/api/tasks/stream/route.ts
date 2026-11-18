import { projectTasksSse } from '@/lib/sse';
import { jsonError } from '@/lib/api-response';
import { requireFullSession } from '@/lib/people-api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;

  const params = new URL(req.url).searchParams;
  const projectId = params.get('project_id')?.trim();
  if (!projectId) return jsonError('project_id is required', 400);
  return projectTasksSse(projectId, params.get('include_dependencies') === '1');
}
