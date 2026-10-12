#!/usr/bin/env node
import { loadTaskyardEnv } from '@taskyard/core';
import { Command } from 'commander';
import { registerAgentsRefresh } from './agents-file.js';
import { registerTaskCommands } from './register-task-commands.js';

loadTaskyardEnv();
import { runTui } from './tui.js';
import { runWorker } from './worker.js';

const program = new Command();

program.name('taskyard').description('Taskyard worker daemon and TUI').version('0.0.1');

program
  .command('worker')
  .description('Run the worker daemon (connects to hub, spawns ACP agents)')
  .requiredOption('--hub <url>', 'WebSocket hub URL (e.g. ws://192.168.1.100:3001)')
  .option('--name <name>', 'Display name for this machine')
  .option('--ports <range>', 'Host port range (e.g. 30000-31000)', '30000-31000')
  .option('--id <id>', 'Override machine ID')
  .option('--local', 'Mark this worker as the local machine (for "Run on this computer")')
  .option('--agents-dir <path>', 'Path to agents/ directory')
  .action(
    async (opts: {
      hub: string;
      name?: string;
      ports: string;
      id?: string;
      agentsDir?: string;
      local?: boolean;
    }) => {
      await runWorker(opts);
    },
  );

program
  .command('tui')
  .description('Terminal UI for thread management')
  .option('--server <url>', 'Taskyard server URL', 'http://localhost:3000')
  .action(async (opts: { server: string }) => {
    await runTui(opts.server);
  });

registerTaskCommands(program);
registerAgentsRefresh(program);

program.parse();
