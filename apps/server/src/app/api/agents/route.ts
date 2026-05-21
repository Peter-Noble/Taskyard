import { listAgents } from '@taskyard/core';
import { jsonOk } from '@/lib/api-response';

export async function GET() {
  return jsonOk({ agents: listAgents() });
}
