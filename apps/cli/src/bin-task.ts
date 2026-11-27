/**
 * Website-installable task CLI entry (esbuild bundle).
 * Excludes the worker, thread dashboard, and native sqlite.
 * Shebang is prepended by apps/cli/scripts/bundle.mjs.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { constants } from 'node:os';
import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { registerAgentsRefresh } from './agents-file.js';
import { loadEnvLite } from './load-env-lite.js';
import { registerAuthCommands } from './register-auth-commands.js';
import { registerIdeaCommands } from './register-idea-commands.js';
import { registerSearchCommands } from './register-search-commands.js';
import { registerTaskCommands } from './register-task-commands.js';
import { writeError } from './task-cli.js';
import { cmdUpdate, findCliUpdate } from './update-check.js';

loadEnvLite();

const program = new Command();
program
  .name('taskyard')
  .description('Taskyard agent/dev CLI (tasks, ideas, setup, sync)')
  .version('0.0.1');

async function chooseUpdate(server: string): Promise<'update' | 'continue' | 'cancel'> {
  const input = createInterface({ input: process.stdin, output: process.stderr });
  let interrupted = false;
  input.on('SIGINT', () => {
    interrupted = true;
    input.close();
  });
  try {
    process.stderr.write(
      `\nTaskyard CLI update available from ${server}\n  1. Update and continue\n  2. Continue without updating\n`,
    );
    input.setPrompt('Choose [1/2]: ');
    input.prompt();
    for await (const line of input) {
      if (line.trim() === '1') return 'update';
      if (line.trim() === '2') return 'continue';
      input.prompt();
    }
    return interrupted ? 'cancel' : 'continue';
  } finally {
    input.close();
  }
}

program.hook('preAction', async (_program, command) => {
  if (command.parent === program && ['update', 'login', 'logout'].includes(command.name())) return;
  const server = await findCliUpdate();
  if (!server) return;

  if (!command.opts().pretty || process.env.TASKYARD_SESSION === 'autonomous' ||
      process.env.TASKYARD_THREAD_ID || !process.stdin.isTTY || !process.stdout.isTTY ||
      !process.stderr.isTTY) {
    process.stderr.write(
      'taskyard: Taskyard CLI update available. Run taskyard update if authorized, or ask your user to update.\n',
    );
    return;
  }

  const choice = await chooseUpdate(server);
  if (choice === 'continue') return;
  if (choice === 'cancel') process.exit(130);

  try {
    const updated = await cmdUpdate(server);
    const child = spawn(process.execPath, [updated.path, ...process.argv.slice(2)], {
      env: { ...process.env, TASKYARD_SKIP_UPDATE_CHECK: '1' },
      stdio: 'inherit',
    });
    const [code, signal] = await once(child, 'close') as [number | null, NodeJS.Signals | null];
    process.exit(code ?? (signal ? 128 + constants.signals[signal] : 1));
  } catch (err) {
    writeError(err);
    process.exit(process.exitCode || 1);
  }
});

registerTaskCommands(program);
registerAuthCommands(program);
registerIdeaCommands(program);
registerSearchCommands(program);

program
  .command('update')
  .description('Download the CLI bundle from this Taskyard server and replace the installed copy')
  .option('--server <url>', 'Taskyard server URL (default: resolved server_url)')
  .option('--pretty', 'Human-readable output instead of JSON')
  .action(async (opts: { server?: string; pretty?: boolean }) => {
    try {
      const result = await cmdUpdate(opts.server);
      if (opts.pretty) {
        process.stdout.write(
          `Updated ${result.path}\nserver: ${result.server_url}\nsha256: ${result.version.sha256}\nversion: ${result.version.version}\n`,
        );
      } else {
        process.stdout.write(`${JSON.stringify(result)}\n`);
      }
    } catch (err) {
      writeError(err);
    }
  });

registerAgentsRefresh(program);
await program.parseAsync();
