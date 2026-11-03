import { threadEventsSse } from '@/lib/sse';
import { requireThreadRead } from '@/lib/thread-access';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const access = requireThreadRead(req, id);
  if (!access.ok) return access.response;
  const since = new URL(req.url).searchParams.get('since');
  return threadEventsSse(id, since);
}
