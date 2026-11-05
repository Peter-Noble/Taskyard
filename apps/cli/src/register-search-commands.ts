import type { Command } from 'commander';
import { cmdSearch } from './search-cli.js';
import { runTaskCommand } from './task-cli.js';

export function registerSearchCommands(program: Command): void {
  program
    .command('search')
    .description('Search task and idea titles, briefs, comments, and decisions')
    .argument('<query>', 'Words, prefix, or exact short id')
    .option('--type <type>', 'Result type (task|idea|all)', 'task')
    .option('--project <id>', 'Project id (default: .taskyard/project.json)')
    .option('--all-projects', 'Search tasks in every project')
    .option('--collection <name-or-id>', 'Filter ideas by collection')
    .option('--limit <count>', 'Maximum results (1-100)', '20')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (query: string, opts: {
      type?: string;
      project?: string;
      allProjects?: boolean;
      collection?: string;
      limit?: string;
      pretty?: boolean;
    }) => {
      await runTaskCommand(() => cmdSearch(query, opts, Boolean(opts.pretty)));
    });
}
