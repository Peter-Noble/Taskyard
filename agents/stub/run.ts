/**
 * Stub agent — emits a fixed JSON-line sequence for automated tests.
 * Never calls external APIs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

function emit(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...event }));
}

const workspace = process.env.TASKYARD_WORKSPACE || '/workspace';
const prompt = process.env.TASKYARD_PROMPT || '';

emit({ type: 'system', event: 'start' });
emit({ type: 'thought', content: `Stub received prompt (${prompt.length} chars)` });

const markerPath = path.join(workspace, '.taskyard-stub-marker.txt');
fs.writeFileSync(markerPath, `stub-${Date.now()}\n`, 'utf-8');
emit({ type: 'file_write', path: markerPath, size_bytes: fs.statSync(markerPath).size });

emit({ type: 'command_run', command: 'echo stub-ok', exit_code: 0, output: 'stub-ok\n' });
emit({ type: 'system', event: 'complete', status: 'success' });
