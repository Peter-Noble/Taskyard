import { jsonOk } from '@/lib/api-response';
import { requireThreadRead } from '@/lib/thread-access';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const access = requireThreadRead(req, (await params).id);
  if (!access.ok) return access.response;
  return jsonOk({ thread: access.thread });
}
