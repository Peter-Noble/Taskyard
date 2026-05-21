import { getDb, listProjects } from '@taskyard/core';
import { jsonOk } from '@/lib/api-response';

export async function GET() {
  const db = getDb();
  return jsonOk({ projects: listProjects(db) });
}
