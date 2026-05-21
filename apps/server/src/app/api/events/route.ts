import { allEventsSse } from '@/lib/sse';

export async function GET(req: Request) {
  const since = new URL(req.url).searchParams.get('since');
  return allEventsSse(since);
}
