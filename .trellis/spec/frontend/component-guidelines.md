# Frontend Component Guidelines

> **Status: Deferred** — no UI framework.

The unit of reuse is a **factory function** (`createXxxPanel({...deps})`)
in `web/js/`. Styling lives in `web/css/style.css` and is driven by
`data-state` / `data-variant` / `aria-pressed` attributes.

For factory patterns and ownership rules, see
[`./quality-guidelines.md`](./quality-guidelines.md). For module
locations, see [`./directory-structure.md`](./directory-structure.md).

This file becomes relevant only if the PRD explicitly approves a UI
framework. Until then, treat any framework runtime import in `web/js/`
as a code-review blocker.
