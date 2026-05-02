# Database Guidelines

> **Status: Not Applicable** — this project has no database.

---

## Why

Helmet Console is a **forward-only WebSocket relay**. The server never reads
`payload` content, never persists frames, and intentionally avoids any data
storage layer (in-memory, file, or DB). See `docs/architecture.md` §1 ("关键
约束") and the "no persistence" rule under Forbidden Patterns in
[`./quality-guidelines.md`](./quality-guidelines.md).

The frontend persists exactly five `console.ws.*` keys to `localStorage`; that
is documented in [`../frontend/state-management.md`](../frontend/state-management.md)
and is out of scope for this file.

---

## When this file becomes relevant

Only if a future PRD explicitly adds one of the deferred extensions in
`docs/architecture.md` §9, e.g.:

- "消息持久化 + 回放" (message persistence + replay) → ringbuffer / sqlite
- "鉴权（token / basic）" (auth) if it requires a user store

Until then, treat any `import` of `better-sqlite3`, `pg`, `mongoose`, or
similar in `server/` as a code-review blocker.
