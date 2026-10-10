import { TaskError } from '@taskyard/core';
import { jsonError } from '@/lib/api-response';

export function taskErrorResponse(err: unknown, fallback: string) {
  if (err instanceof TaskError) {
    return jsonError(err.message, err.statusCode, { code: 'TASK_ERROR' });
  }
  return jsonError(err instanceof Error ? err.message : fallback, 500);
}
