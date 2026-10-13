# UI prototypes

Prototype UI choices **on the running dev server** (`pnpm dev:server`), not as static HTML under `design/`.

`design/v1` and `design/v2` are archived visual handoffs. They are not where agents put new interactive mocks for product decisions.

## Pattern

1. Gate the mock behind a query param on the real route, e.g. `/dashboard?ta-35-design=A`.
2. Use one param name per prototype question on that task, e.g. `ta-35-design` (filter) and `ta-35-labels` (field layout). Prefer `{short-id-lower}-…`.
3. Letter values (`A`, `B`, `C`, …) for mutually exclusive options; include an in-page switcher when several options exist.
4. Keep prototype components/CSS clearly temporary and remove them when the task ships the chosen design.
5. Tell the reviewer the full URL(s) on the local server (default port **3004**).

Do not open `file://` screens or add one-off HTML under `design/` for agent-driven design picks.
