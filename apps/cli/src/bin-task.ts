/**
 * Website-installable task CLI entry (esbuild bundle).
 * No worker/TUI and no `@taskyard/db` / native sqlite.
 * Shebang is prepended by apps/cli/scripts/bundle.mjs.
 */
import { Command } from 'commander';
import { registerAgentsRefresh } from './agents-file.js';
import { loadEnvLite } from './load-env-lite.js';
import { registerTaskCommands } from './register-task-commands.js';
import { writeError } from './task-cli.js';
import { cmdUpdate, warnIfCliUpdateAvailable } from './update-check.js';

loadEnvLite();

const program = new Command();
program
  .name('taskyard')
  .description('Taskyard agent/dev CLI (task board, setup, sync)')
  .version('0.0.1');

program.hook('preAction', async () => {
  await warnIfCliUpdateAvailable();
});

registerTaskCommands(program);

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
program.parse();
