export const TASK_CLI_CONTRACT = `## Taskyard

A short id in the user's message, such as \`TA-14\`, is a task in this project. Run \`taskyard task get <id>\` and use that JSON as the spec before any other lookup. Then \`taskyard task claim <id>\` before editing code. Use \`show-thread\` when the user means the task already bound to this thread, and \`task next\` when they ask for the next task.

Do not create Taskyard tasks for interactive experiments or one-off asks from the user. Do the work in the conversation. If you think something you are already working on should become a task, ask the user first; do not create it on your own.

Persist progress with the \`taskyard task\` CLI. It prints JSON on stdout. The project id is already in \`.taskyard/project.json\`. The CLI reads that file. Do not set \`TASKYARD_PROJECT_ID\` and do not look the id up.

- \`taskyard task show-thread\` — this thread and its primary task
- \`taskyard task list [--status ready]\` — tasks in this project
- \`taskyard task next\` — oldest ready or merge, unblocked, unclaimed task; merge tasks go first
- \`taskyard task get <id>\` — task, children, dependencies, decisions, and activity
- \`taskyard task claim <id>\` — take a ready or merge task; fails if someone else holds it or it is blocked
- \`taskyard task status <id> <status>\` — backlog, ready, in_progress, review, merge, waiting, completed, cancelled
- \`taskyard task status <id> waiting --reason "..."\` — park it for a person or an external blocker
- \`taskyard task comment <id> "..."\` — what changed, what is left, how the work was completed, and the state you left the project in
- \`taskyard task update <id> [--title] [--description] [--assignee]\` — change the task. \`--description\` replaces the brief, which is the work the task asks for
- \`taskyard task create --title "..." [--parent <id>] [--description "..."]\`
- \`taskyard task depend <id> --on <other>\`
- \`taskyard task decision add --task <id> --choice "..."\` — one statement for a non-obvious choice that is still true after the task

Claim a task before you start it. \`ready\` means an agent may claim it. \`review\` means the work is finished and a person should look. \`merge\` means the person approved the work and any agent may claim it to merge the branch. \`task next\` returns \`merge\` tasks before \`ready\` ones, so a task in \`review\` waits for a person. \`review\` and \`merge\` tasks still block anything that depends on them.

One task is one branch named after the task, such as \`ta-14-short-slug\`. If \`git status\` is clean and no other task in this project is \`in_progress\`, create the branch in this checkout and work here. If the tree is dirty or another task is in progress, stop and tell the user; never stash or discard changes you did not make. Commit on the task branch as you finish; a fix you had to make along the way goes in its own commit. Branching and committing on the task branch are pre-approved; ask before push, reset, rebase, or merging into the default branch. If you park an unfinished task, keep the branch and name it in the task comment so the next session can pick it up.

To finish a \`merge\` task: claim it, merge its branch into the default branch with a plain merge commit, delete the task branch, then set the task \`completed\`. A task approved before the branch workflow has no task branch; when its commits are already on the default branch, set it \`completed\` without merging. If the merge conflicts, comment with the conflict and set the task back to \`review\`.

The brief is the task description. It describes the work the task asks for. Leave it in place when you finish. Do not rewrite it into a report of the work. How the task was completed, and the state you left the project in, goes in a comment.

Before you stop, write the task back:

1. \`taskyard task comment <id> "..."\` with what changed, what is left, how the work was completed, and the state you left the project in.
2. \`taskyard task decision add --task <id> --choice "..."\` for each non-obvious choice that cannot be inferred from the code. One statement. No reason. State a fact that is still true in the code that remains after this task. Leave out symbols, files, and prompt details this task removes; the decision is read after they are gone. Skip this when there was no such choice. Cite the decision id in a short comment on the code that follows the rule, for example \`// D-014\`.
3. Commit everything on the task branch, then set the status:
   - \`review\` when \`TASKYARD_SESSION=autonomous\`, or when you are finishing without the user confirming the work. The board shows this as Ready to review.
   - \`completed\` only after the user in this session agrees the task is done, or when you have merged a \`merge\` task.
   - \`waiting\` with \`--reason\` when you stopped for a person or an external blocker.
   - \`ready\` when the work is unfinished and another agent can continue.
   - \`cancelled\` when the user says to drop it.

Completing a task writes its decisions into \`.taskyard/decisions.md\`, next to \`project.json\`. Both files are committed with the repo. \`taskyard sync\` refreshes the decision file from the server.`;
