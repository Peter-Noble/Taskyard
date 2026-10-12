# People, guests, and collections

Status: plan (grilling session, 2026-10-11, updated 2026-10-12). Builds on [docs/mvp.md](./mvp.md). Does not change the MVP dogfood loop until the slices below land.

## 1. Goal

One person has one account, used from work and home. They see the projects they own and the projects they have been added to. Work and Personal are a private filter over that list. The server is local today; the rules below are the ones to enforce once it is reachable from another machine.

## 2. Decisions

| Topic | Choice |
|--------|--------|
| Account | Username and password. No email |
| Shown name | Display name in the header and in task history |
| First person | Created from the sign-in screen when `people` is empty. They choose their own password |
| Later people | Created by someone who is already signed in. The server shows a temporary password once. The creator passes the username and that password on themselves |
| Next login after create | The person must set a new password before they can do anything else |
| Who manages people | Any signed-in person can open the people screen, create a person, and mark a password reset |
| Who can sign in on a machine's CLI | One person. Logging in replaces the previous CLI session on that machine |
| Same account on another machine | Allowed. Work and home are two CLI logins for one person |
| Project visibility | A person sees projects they own and projects where they are a guest |
| Owner | The person who created the project. They edit project settings and the guest list |
| Guest | Added by username. They already have an account. They can see the project and work its tasks. They cannot launch, steer, or stop a thread, and they cannot change project settings |
| Collections | Private to one person. A project can sit in more than one of that person's collections. Collections are not shared |
| Active collection | Stored in the browser. Switching it filters the whole UI on that browser. Another machine signed in as the same person keeps its own selection |
| Agent history | Unchanged from the worker today: `TASKYARD_ACTOR` is `<agent type>:<thread id prefix>`. A person using the CLI is recorded as their display name |
| Existing projects | When the owner column is added, every current project is assigned to the earliest person |

Terms live in `CONTEXT.md`.

## 3. What exists today

- No people table and no session. The header chip in `apps/server/src/components/app-shell.tsx` is a static control labelled Peter.
- Web UI writes are stored with the actor `user`. Fixture data uses Peter.
- `actorFromEnv()` in `apps/cli/src/task-cli.ts` uses `TASKYARD_ACTOR`, otherwise `agent`.
- The worker already sets `TASKYARD_ACTOR` to `<agent type>:<thread id prefix>` in `apps/cli/src/agent-env.ts`.
- Project list, task, and thread routes do not check who is calling.
- TA-17 is the local sign-in. TA-16 (read markers) and TA-8 (require login before the server leaves this machine) are blocked on it.

## 4. Passwords

The `people` table stores `password_hash` and nothing else about the secret. The hash is Node `scrypt`. A temporary password, a new password, and a current password are never written to the database, the session row, or a log line.

The web cookie is HTTP-only and holds a random session token. Only `token_hash` is stored. The CLI token lives in the user profile (`%USERPROFILE%\.taskyard\credentials.json` on Windows), never in a repo.

Three ways a password changes:

| Situation | What they prove | What gets stored |
|-----------|-----------------|------------------|
| First person, choosing a password | Nothing yet; the table is empty | Hash of the password they chose. `must_change_password` is false |
| Voluntary change, already signed in | Current password | Hash of the new password |
| Create, or issue a temporary password | The signed-in creator | Hash of a generated temporary password. `must_change_password` is true. The temporary password is shown once on screen |
| Mark for password reset | The signed-in person marking it | The flag only. The existing hash stays. Next login with the current password must set a new one |

A session with `must_change_password` set can call only the set-new-password endpoint, then sign-in again. Task, project, and thread routes reject it. The web UI shows the new-password form and nothing else. `taskyard login` in that state asks for a new password before it writes the credential file.

Username is immutable. It is the key used to add a guest. A person can change their own display name while signed in. People are not deleted, so older comments keep a stable name.

## 5. Creating a person, and the people screen

There is no pending invite and no link to click. Creating a person inserts the row immediately.

1. Someone signed in opens People and enters a username and a display name.
2. The server generates a temporary password, stores its hash, sets `must_change_password`, and shows the username and temporary password once.
3. The creator sends those two values to the new person.
4. That person's next login accepts the temporary password only as far as setting a new one. The flag clears when the new password is saved.

The People screen lists every person: username, display name, when they were created, and whether a password reset is waiting. From a row, a signed-in person can:

- Mark for password reset. The current password still works once, and that login must set a new password.
- Issue a new temporary password. This replaces the hash, shows the new secret once, and sets the same flag. This is how a forgotten password is recovered.

The same screen is where the second and later accounts are created. Adding a guest is unchanged: the owner types a username, and the person must already exist.

## 6. Data model

Add to `packages/db/src/schema.ts`:

| Table | Columns |
|--------|---------|
| `people` | `id`, `username` unique, `display_name`, `password_hash`, `must_change_password`, `created_at` |
| `sessions` | `id`, `person_id`, `token_hash`, `kind` (`web` \| `cli`), `created_at` |
| `project_guests` | `project_id`, `person_id`, primary key on both |
| `collections` | `id`, `person_id`, `name`, unique on (`person_id`, `name`) |
| `collection_projects` | `collection_id`, `project_id`, primary key on both |

`projects` gains `owner_id` referencing `people`.

`tasks.assignee` stays a string. New claims from the UI and the CLI write the person's display name. This plan does not turn assignee into a person id.

## 7. Access rules

Once login is required:

| Action | Owner | Guest | Anyone else |
|--------|-------|-------|-------------|
| See the project, its tasks, and its threads | yes | yes | no |
| Create and edit tasks, comments, decisions, dependencies, status, claim | yes | yes | no |
| Launch a thread, follow up, answer a prompt, kill, close | yes | no | no |
| Edit name, repo, default branch, archive, task prefix | yes | no | no |
| Add or remove guests | yes | no | no |
| Create a project | any signed-in person; they become its owner | | |
| List people, create a person, mark a password reset, issue a temporary password | any signed-in person | | |
| Change own display name and password | that person | | |

A collection never grants access. The project list is "projects this person can see", then narrowed to the active collection. `All` is every project they can see.

The CLI ignores the active collection. It is already scoped to the checkout's project.

Vault and machine routes are host controls, not project membership. This plan leaves them available to every signed-in person. Do not treat a guest as unable to open those pages until a later change says so.

## 8. Slices

Each slice is shippable on its own. Later slices assume the earlier ones are in.

### Slice 1 — Person and web sign-in

Lands in TA-17. Widen that brief before coding: the person has a username, a password hash, a display name, and a must-change-password flag. The task API stays open for the CLI and for agents, which is the current TA-17 boundary.

- An empty `people` table shows a create-account form. That person chooses their password and is not flagged for reset.
- After that, People is where a signed-in person creates the next account, sees the temporary password once, and marks a reset or issues a new temporary password.
- Sign in and sign out from the web UI. A flagged account sees only the new-password form. After that, the header chip shows the display name.
- Comments, status changes, and decisions made in the UI use that display name as the actor.
- The server reads the signed-in person on a later request so TA-16 can store a read marker against them.
- A person can change their own display name and password while signed in. A voluntary change requires the current password.

Done when the first person can create a second, hand them the temporary password, and that second person must set a new password before they can leave a comment under their own name. The CLI still works with no token. A password column dump shows hashes only.

### Slice 2 — Collections

Needs slice 1. Does not need the API lock.

- A person can create and delete collections, and put a project in or take it out.
- The header has a switcher: `All` and that person's collection names.
- The choice is a browser cookie. Project list, task board, thread list, and the New Thread project picker follow it.
- Creating a project while a collection is active adds the new project to that collection.
- Archived projects stay hidden the way they are today.

Done when Work and Personal can both contain the same project, and choosing one of them hides the other projects in the UI on that browser only.

### Slice 3 — Require login

Lands in TA-8. Do this before binding the server beyond this machine. Start it only after slice 1.

- Web UI and the task, project, and thread APIs reject a request with no session.
- `taskyard login` / `taskyard logout`. Login writes the CLI credential file and replaces whatever person was signed in on that machine.
- A flagged account cannot finish CLI login until it sets a new password in that same command.
- A person running the CLI is recorded as their display name.
- The worker keeps setting `TASKYARD_ACTOR` to `<agent type>:<thread id prefix>` and sends the machine's CLI credential with those calls. Agent history stays distinct from the person.
- Localhost without a session is not a bypass.

Done when the web UI and `taskyard task` fail until that person has signed in, an agent spawned by the worker still updates tasks, and the history shows the agent actor rather than the person.

### Slice 4 — Owner and guests

Ship this before the server is reachable from another machine. Slice 3 without this slice lets any signed-in person see every project.

- Backfill `owner_id` on existing projects to the earliest person.
- New projects set `owner_id` to the creator.
- Owner adds a guest by username. Unknown username is an error. The person is created on the People screen first.
- Owner removes a guest. The guest loses the project on the next request. Tasks they touched stay as they are.
- Enforce the table in §7 on the project, task, and thread routes.
- Guests do not see New Thread, and the thread endpoints reject them.
- Project settings and the guest list are shown to the owner.

Done when a second person sees a project only after they are added, can comment on a task there, and cannot start a thread or edit the repo URL.

## 9. After this plan

TA-16 stays the read marker. It needs the person id from slice 1 and does not need guests.

Separate agent sessions are already distinguishable: the worker's actor string includes the agent type and a thread id prefix. This plan does not add agent accounts.

## 10. Out of scope

- Email, invite links, and a pending invite row.
- Deleting or disabling a person.
- Sharing a collection.
- A guest launching or steering a thread.
- Any role besides owner and guest on a project.
- Hiding vault and machines from a guest.
- Turning `assignee` into a person id.
