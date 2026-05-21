import { threadEventsSse } from '@/lib/sse';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const since = new URL(req.url).searchParams.get('since');
  return threadEventsSse(id, since);
}
