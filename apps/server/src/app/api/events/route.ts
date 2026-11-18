import { allEventsSse } from '@/lib/sse';
import { requireFullSession } from '@/lib/people-api';

export async function GET(req: Request) {
  const gate = requireFullSession(req);
  if (!gate.ok) return gate.response;
  const since = new URL(req.url).searchParams.get('since');
  return allEventsSse(since, gate.person.id);
}
