import type { Command } from 'commander';
import {
  cmdIdeaArchive,
  cmdIdeaComment,
  cmdIdeaCreate,
  cmdIdeaGet,
  cmdIdeaList,
  cmdIdeaPromote,
  cmdIdeaUpdate,
  IDEA_STATUSES,
} from './idea-cli.js';
import { writeError } from './task-cli.js';

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (err) {
    writeError(err);
    process.exitCode = 1;
  }
}

export function registerIdeaCommands(program: Command): void {
  const idea = program.command('idea').description('Private project ideas and promotion');

  idea
    .command('create')
    .requiredOption('--title <title>', 'Idea title')
    .option('--description <text>', 'Idea brief')
    .option('--collection <name-or-id>', 'Collection; repeat for multiple', (value, all: string[] = []) => [...all, value], [])
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: { title: string; description?: string; collection?: string[]; pretty?: boolean }) => {
      await run(() => cmdIdeaCreate(opts, Boolean(opts.pretty)));
    });

  idea
    .command('list')
    .option('--collection <name-or-id>', 'Filter by collection')
    .option('--status <status>', `Filter by status (${IDEA_STATUSES.join('|')})`)
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: { collection?: string; status?: string; pretty?: boolean }) => {
      await run(() => cmdIdeaList(opts, Boolean(opts.pretty)));
    });

  idea
    .command('get')
    .argument('[id]', 'Idea id (default: $TASKYARD_IDEA_ID)')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string | undefined, opts: { pretty?: boolean }) => {
      await run(() => cmdIdeaGet(id, Boolean(opts.pretty)));
    });

  idea
    .command('update')
    .argument('<id>', 'Idea id or short id')
    .option('--title <title>', 'New title')
    .option('--description <text>', 'Replace the idea brief')
    .option('--collection <name-or-id>', 'Replace collections; repeat for multiple', (value, all: string[] = []) => [...all, value])
    .option('--clear-collections', 'Remove the idea from every collection')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string, opts: { title?: string; description?: string; collection?: string[]; clearCollections?: boolean; pretty?: boolean }) => {
      await run(() => cmdIdeaUpdate(id, opts, Boolean(opts.pretty)));
    });

  idea
    .command('comment')
    .argument('<id>', 'Idea id or short id')
    .argument('<text>', 'Comment text')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string, text: string, opts: { pretty?: boolean }) => {
      await run(() => cmdIdeaComment(id, text, Boolean(opts.pretty)));
    });

  idea
    .command('archive')
    .argument('<id>', 'Idea id or short id')
    .option('--restore', 'Restore an archived idea')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string, opts: { restore?: boolean; pretty?: boolean }) => {
      await run(() => cmdIdeaArchive(id, Boolean(opts.restore), Boolean(opts.pretty)));
    });

  idea
    .command('promote')
    .argument('<id>', 'Idea id or short id')
    .option('--name <name>', 'Project name (default: idea title)')
    .option('--repo-url <url>', 'Optional HTTPS repository URL')
    .option('--default-branch <branch>', 'Default branch', 'main')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string, opts: { name?: string; repoUrl?: string; defaultBranch?: string; pretty?: boolean }) => {
      await run(() => cmdIdeaPromote(id, opts, Boolean(opts.pretty)));
    });
}
