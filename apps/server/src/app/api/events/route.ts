import { allEventsSse } from '@/lib/sse';
import { requireIdeaPerson } from '@/lib/ideas-api';

export async function GET(req: Request) {
  const gate = requireIdeaPerson(req);
  if (!gate.ok) return gate.response;
  const since = new URL(req.url).searchParams.get('since');
  return allEventsSse(since, gate.person.id);
}
