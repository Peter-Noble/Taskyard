/** Codex agent — uses OpenAI Chat Completions API with native fetch. */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Event {
  type: string;
  [key: string]: unknown;
}

function emit(event: Event): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  });
  console.log(line);
}

const API_KEY = process.env.OPENAI_API_KEY;
const WORKSPACE = process.env.TASKYARD_WORKSPACE || '/workspace';
const PROMPT = process.env.TASKYARD_PROMPT || '';
const MODEL = process.env.CODEX_MODEL || 'gpt-4o';
const MAX_ITERATIONS = parseInt(process.env.CODEX_MAX_ITERATIONS || '50', 10);

if (!API_KEY) {
  emit({ type: 'error', message: 'Missing OPENAI_API_KEY' });
  emit({ type: 'system', event: 'complete', status: 'error' });
  process.exit(1);
}

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.join(WORKSPACE, p);
}

function readFile(filePath: string): string {
  const full = resolvePath(filePath);
  try {
    const content = fs.readFileSync(full, 'utf-8');
    emit({ type: 'file_read', path: full });
    return content;
  } catch (e: any) {
    emit({ type: 'file_read', path: full });
    return `Error reading file: ${e.message}`;
  }
}

function writeFile(filePath: string, content: string): string {
  const full = resolvePath(filePath);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(full, content, 'utf-8');
  emit({ type: 'file_write', path: full, size_bytes: Buffer.byteLength(content, 'utf-8') });
  return `Wrote ${content.length} characters to ${filePath}`;
}

function runCommand(command: string): string {
  try {
    const output = execSync(command, {
      cwd: WORKSPACE,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    emit({ type: 'command_run', command, exit_code: 0, output: output.slice(0, 2000) });
    return output;
  } catch (e: any) {
    const output = (e.stdout || '') + (e.stderr || '');
    emit({ type: 'command_run', command, exit_code: e.status || 1, output: output.slice(0, 2000) });
    return output;
  }
}

type Message =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

const tools = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file in the workspace',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute file path' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file in the workspace',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute file path' },
          content: { type: 'string', description: 'Full file content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in the workspace',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['command'],
      },
    },
  },
];

async function main(): Promise<void> {
  emit({ type: 'system', event: 'start' });

  const messages: Message[] = [
    {
      role: 'system',
      content:
        'You are a coding agent running in an isolated environment. ' +
        'You have access to tools to read files, write files, and run shell commands. ' +
        'Use these tools to complete the user\'s task. Think step by step. ' +
        'After each tool use, review the result and decide the next action. ' +
        'When you are done, do not call any more tools.',
    },
    { role: 'user', content: PROMPT },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: 'auto' }),
    });

    if (!res.ok) {
      const text = await res.text();
      emit({ type: 'error', message: `OpenAI API error ${res.status}: ${text}` });
      break;
    }

    const data = await res.json();
    const choice = data.choices[0];
    const msg = choice.message;

    if (msg.content) {
      emit({ type: 'thought', content: msg.content });
    }

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      break;
    }

    messages.push({
      role: 'assistant',
      content: msg.content || '',
      tool_calls: msg.tool_calls,
    });

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments);
      let result = '';

      if (name === 'read_file') {
        result = readFile(args.path);
      } else if (name === 'write_file') {
        result = writeFile(args.path, args.content);
      } else if (name === 'run_command') {
        result = runCommand(args.command);
      } else {
        result = `Unknown tool: ${name}`;
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  emit({ type: 'system', event: 'complete', status: 'success' });
}

main().catch((e) => {
  emit({ type: 'error', message: String(e) });
  emit({ type: 'system', event: 'complete', status: 'error' });
  process.exit(1);
});
