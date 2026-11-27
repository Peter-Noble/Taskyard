import { TASK_PRIORITIES, TASK_TYPES } from '@taskyard/protocol';
import { Option, type Command } from 'commander';
import {
  cmdClaim,
  cmdComment,
  cmdCreate,
  cmdDecisionAdd,
  cmdDepend,
  cmdExportDecisions,
  cmdGet,
  cmdLink,
  cmdList,
  cmdNext,
  cmdSetup,
  cmdShowThread,
  cmdStatus,
  cmdSync,
  cmdUpdate,
  runTaskCommand,
  writeError,
  DEFAULT_SERVER_URL,
  TASK_STATUSES,
} from './task-cli.js';

function addTaskLabelOptions(command: Command): Command {
  return command
    .addOption(new Option('--type <type>', 'Task type').choices([...TASK_TYPES]))
    .addOption(new Option('--priority <priority>', 'Task priority').choices([...TASK_PRIORITIES]))
    .option('--category <text>', 'Free-text category');
}

/** Registers `task *`, `setup`, `sync`, and `link` on a commander program. */
export function registerTaskCommands(program: Command): void {
  const task = program
    .command('task')
    .description('Task board CRUD against the Taskyard REST API (agent-facing)');

  task
    .command('get')
    .description('Get a task by id (default: $TASKYARD_TASK_ID)')
    .argument('[id]', 'Task id')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string | undefined, opts: { pretty?: boolean }) => {
      await runTaskCommand(() => cmdGet(id, Boolean(opts.pretty)));
    });

  task
    .command('list')
    .description('List tasks')
    .option('--project <id>', 'Filter by project id')
    .option('--status <status>', `Filter by status (${TASK_STATUSES.join('|')})`)
    .option('--parent <id>', 'Filter by parent task id')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(
      async (opts: { project?: string; status?: string; parent?: string; pretty?: boolean }) => {
        await runTaskCommand(() =>
          cmdList(
            { project: opts.project, status: opts.status, parent: opts.parent },
            Boolean(opts.pretty),
          ),
        );
      },
    );

  addTaskLabelOptions(task.command('create'))
    .description('Create a task')
    .requiredOption('--title <title>', 'Task title')
    .option('--parent <id>', 'Parent task id for subtasks')
    .option('--project <id>', 'Project id (default: .taskyard/project.json or $TASKYARD_PROJECT_ID)')
    .option('--description <text>', 'Brief: the work this task asks for')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: Parameters<typeof cmdCreate>[0] & { pretty?: boolean }) => {
      await runTaskCommand(() => cmdCreate(opts, Boolean(opts.pretty)));
    });

  task
    .command('status')
    .description('Update task status')
    .argument('<id>', 'Task id')
    .argument('<status>', `New status (${TASK_STATUSES.join('|')})`)
    .option('--reason <text>', 'Required when status is waiting')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string, status: string, opts: { pretty?: boolean; reason?: string }) => {
      await runTaskCommand(() => cmdStatus(id, status, Boolean(opts.pretty), opts.reason));
    });

  addTaskLabelOptions(task.command('update'))
    .description('Change a task title, brief, assignee, type, priority, or category')
    .argument('<id>', 'Task id or short id')
    .option('--title <title>', 'New title')
    .option('--description <text>', 'Replace the brief when the work the task asks for has changed')
    .option('--assignee <name>', 'Assignee, or empty string to clear')
    .addOption(new Option('--clear-category', 'Remove the category').conflicts('category'))
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(
      async (
        id: string,
        opts: Parameters<typeof cmdUpdate>[1] & { clearCategory?: boolean; pretty?: boolean },
      ) => {
        await runTaskCommand(() =>
          cmdUpdate(
            id,
            { ...opts, category: opts.clearCategory ? null : opts.category },
            Boolean(opts.pretty),
          ),
        );
      },
    );

  task
    .command('claim')
    .description('Claim a ready, unblocked task')
    .argument('<id>', 'Task id or short id')
    .option('--as <name>', 'Assignee (default: $TASKYARD_ACTOR or $TASKYARD_THREAD_ID)')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string, opts: { as?: string; pretty?: boolean }) => {
      await runTaskCommand(() => cmdClaim(id, opts.as, Boolean(opts.pretty)));
    });

  task
    .command('next')
    .description(
      'Oldest ready or merge, unblocked, unclaimed task in the project; merge tasks go first',
    )
    .option('--project <id>', 'Project id (default: .taskyard/project.json or $TASKYARD_PROJECT_ID)')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: { project?: string; pretty?: boolean }) => {
      await runTaskCommand(() => cmdNext(opts.project, Boolean(opts.pretty)));
    });

  task
    .command('depend')
    .description('Block a task until another task is completed or cancelled')
    .argument('<id>', 'Task id or short id')
    .requiredOption('--on <id>', 'Task this one depends on')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string, opts: { on: string; pretty?: boolean }) => {
      await runTaskCommand(() => cmdDepend(id, opts.on, Boolean(opts.pretty)));
    });

  const decision = task.command('decision').description('Design decisions recorded on a task');

  decision
    .command('add')
    .description('Record a non-obvious design decision')
    .requiredOption('--task <id>', 'Task id or short id')
    .requiredOption(
      '--choice <text>',
      'One statement that is still true in the code that remains after the task',
    )
    .option('--why <text>', 'Optional reason, kept off the agent contract')
    .option('--rejected', 'Record the choice as rejected')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(
      async (opts: {
        task: string;
        choice: string;
        why?: string;
        rejected?: boolean;
        pretty?: boolean;
      }) => {
        await runTaskCommand(() =>
          cmdDecisionAdd(
            { task: opts.task, choice: opts.choice, why: opts.why, rejected: opts.rejected },
            Boolean(opts.pretty),
          ),
        );
      },
    );

  decision
    .command('export')
    .description('Write completed-task decisions into .taskyard/decisions.md')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: { pretty?: boolean }) => {
      await runTaskCommand(() => cmdExportDecisions(Boolean(opts.pretty)));
    });

  task
    .command('comment')
    .description(
      'Record what changed, how the work was completed, and the state you left the project in',
    )
    .argument('<id>', 'Task id')
    .argument('<text>', 'Comment text')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (id: string, text: string, opts: { pretty?: boolean }) => {
      await runTaskCommand(() => cmdComment(id, text, Boolean(opts.pretty)));
    });

  task
    .command('show-thread')
    .description('Show thread context (uses $TASKYARD_THREAD_ID)')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: { pretty?: boolean }) => {
      await runTaskCommand(() => cmdShowThread(Boolean(opts.pretty)));
    });

  program
    .command('setup')
    .description(
      'Write .taskyard/project.json, sync .taskyard/decisions.md, and install the Taskyard section in AGENTS.md',
    )
    .option('--project <id>', 'Taskyard project id (required on first setup)')
    .option('--dir <path>', 'Project checkout', process.cwd())
    .option('--server <url>', 'Taskyard server URL')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: { project?: string; dir?: string; server?: string; pretty?: boolean }) => {
      try {
        await cmdSetup(
          { project: opts.project, dir: opts.dir, server: opts.server },
          Boolean(opts.pretty),
        );
      } catch (err) {
        writeError(err);
      }
    });

  program
    .command('sync')
    .description('Refresh .taskyard/decisions.md from the Taskyard server')
    .option('--dir <path>', 'Project checkout', process.cwd())
    .option('--server <url>', 'Taskyard server URL')
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: { dir?: string; server?: string; pretty?: boolean }) => {
      try {
        await cmdSync({ dir: opts.dir, server: opts.server }, Boolean(opts.pretty));
      } catch (err) {
        writeError(err);
      }
    });

  program
    .command('link')
    .description('Write .taskyard/project.json so task commands can find this project')
    .requiredOption('--project <id>', 'Taskyard project id')
    .option('--dir <path>', 'Project directory', process.cwd())
    .option('--server <url>', 'Taskyard server URL', DEFAULT_SERVER_URL)
    .option('--pretty', 'Human-readable output instead of JSON')
    .action(async (opts: { project: string; dir?: string; server?: string; pretty?: boolean }) => {
      try {
        await cmdLink(
          { project: opts.project, dir: opts.dir, server: opts.server },
          Boolean(opts.pretty),
        );
      } catch (err) {
        writeError(err);
      }
    });
}
