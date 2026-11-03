export const IDEA_CLI_CONTRACT = `## Taskyard project idea

You are discussing a private project idea in a scratch directory with no repository. The idea id is in TASKYARD_IDEA_ID. Use the taskyard CLI; it prints JSON on stdout.

- taskyard idea get — read the current idea, brief, collections, and history
- taskyard idea comment <id> "..." — record conclusions or open questions
- taskyard idea update <id> [--title "..."] [--description "..."] — refine the idea when the person asks
- taskyard idea promote <id> [--name "..."] [--repo-url "..."] [--default-branch main] — create the project when the person asks

Promotion returns the idea and project, including project.id. The idea then becomes read-only. To create initial work, pass that project id explicitly:

  taskyard task create --project <project_id> --title "..." --description "..."

Do not create tasks before promotion. Do not create a placeholder task merely because promotion succeeded; create only the initial tasks requested or agreed in the discussion.`;
