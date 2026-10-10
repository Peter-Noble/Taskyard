import fs from 'node:fs';
import path from 'node:path';
import type { TaskDecision } from '@taskyard/protocol';
import { decisionsFilePath } from './project-file.js';

function decisionHeading(decision: TaskDecision): string {
  return `## ${decision.id} — ${decision.choice}`;
}

function decisionBody(decision: TaskDecision): string {
  const lines = [
    decisionHeading(decision),
    '',
    `- Status: ${decision.status}`,
    `- Task: ${decision.task_short_id}`,
  ];
  const why = decision.why.trim();
  if (why) lines.push('', why);
  return lines.join('\n');
}

/** Appends decisions that are not already in `.taskyard/decisions.md`. Returns every id now recorded in the file. */
export function syncDecisionsFile(workspace: string, decisions: TaskDecision[]): string[] {
  const file = decisionsFilePath(workspace);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const present = (id: string) => new RegExp(`^## ${id}\\b`, 'm').test(existing);
  const missing = decisions.filter((decision) => !present(decision.id));
  if (missing.length === 0) {
    return decisions.filter((decision) => present(decision.id)).map((decision) => decision.id);
  }

  const block = missing.map(decisionBody).join('\n\n') + '\n';
  if (!existing.trim()) {
    fs.writeFileSync(file, `# Design decisions\n\n${block}`);
  } else {
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    fs.appendFileSync(file, separator + block);
  }
  return decisions.map((decision) => decision.id);
}
