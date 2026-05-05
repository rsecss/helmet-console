# Frontend Hook Guidelines

> **Status: Deferred** — no framework, so no hooks.

Stateful logic that would be a hook in React is expressed as closure
state inside the relevant factory function (`ws-client.js`,
`config-panel.js`, `control-panel.js`, …). Inbound frame routing happens
through `main.js` callbacks (`onFrame`, `onStatus`, …).

See [`./quality-guidelines.md`](./quality-guidelines.md) and
[`./state-management.md`](./state-management.md) for the callback-injection
wiring style.

This file becomes relevant only if the PRD explicitly approves a
hook-based framework. Until then, treat any framework runtime import in
`web/js/` as a code-review blocker.
