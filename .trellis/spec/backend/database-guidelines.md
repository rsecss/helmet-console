# Backend Database Guidelines

> **Status: Not Applicable** — the relay is forward-only and never persists frames.

The frontend persists `console.ws.*` and `console.ai.*` to `localStorage`;
that is documented in [`../frontend/state-management.md`](../frontend/state-management.md).

This file becomes relevant only if a future PRD adds persistence (see
`docs/architecture.md` §9 deferred extensions). Until then, treat any
`import` of `better-sqlite3` / `pg` / `mongoose` / similar in `server/`
as a code-review blocker.
