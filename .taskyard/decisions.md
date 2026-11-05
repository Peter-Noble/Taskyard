# Design decisions

## D-001 — Open and closed dashboard panels are stored in the taskyard-panels cookie.

- Status: accepted
- Task: TA-14

## D-003 — Moving a task to merge releases its assignee so any agent can claim the merge

- Status: accepted
- Task: TA-23

## D-002 — Thread prompts still include the CLI contract after worktree preparation writes those instructions.

- Status: accepted
- Task: TA-3

## D-004 — Marking a password reset leaves that person's current web session signed in. Issuing a temporary password ends their sessions.

- Status: accepted
- Task: TA-17

## D-005 — The active collection is stored in the browser. Reordering projects inside a collection does not change the server-wide project order.

- Status: accepted
- Task: TA-25

## D-006 — A person creates and deletes their collections from a dialog on the Projects page.

- Status: accepted
- Task: TA-25

## D-007 — Task list filter uses design A: funnel icon opening a popover with Type checkboxes (all on), a snapping Priority min–max range, and Status checkboxes with Completed and Cancelled off by default.

- Status: accepted
- Task: TA-35

## D-008 — Type, Priority, and Category use labels layout C: compact matched-height fields on create; on the task page they show as header pills that open edit popups when clicked.

- Status: accepted
- Task: TA-35

## D-009 — Ideas are private pre-project records with independent activity; promotion preserves a read-only origin and never creates an initial task automatically.

- Status: accepted
- Task: TA-44

## D-010 — Idea discussions run in projectless scratch directories and become associated with the new project when promoted.

- Status: accepted
- Task: TA-44

## D-011 — Non-owner readers of a promoted origin idea never receive the owner's collection memberships.

- Status: accepted
- Task: TA-44

## D-012 — Thread Markdown does not render raw HTML or remote images.

- Status: accepted
- Task: TA-49

## D-013 — Task search is scoped to the Dashboard's selected project by default, idea search is scoped to the active collection, and no app-wide current-project state is shared.

- Status: accepted
- Task: TA-20

## D-014 — Full-text search documents are maintained by SQLite triggers so write callers do not need to update the index.

- Status: accepted
- Task: TA-20

## D-015 — The permanent search UI is a centered command palette; alternate drawer and top-sheet prototypes are not retained.

- Status: accepted
- Task: TA-20

## D-016 — The search palette uses a rectangular frame with 56px fading line extensions and an oklch(12% 0.012 250 / 0.18) backdrop.

- Status: accepted
- Task: TA-20
