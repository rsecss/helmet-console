# Hook Guidelines

> **Status: Deferred** — this project has no framework, so no hooks.

---

## Why

There is no React / Vue / Svelte runtime in `web/`, so the concept of a
hook (`useXxx`) does not apply. The frontend uses **factory functions** that
take dependencies (DOM elements + callbacks) and return a small public API.

Stateful logic that would be a hook in React is currently expressed as:

| Concern                          | Implementation                                   |
| -------------------------------- | ------------------------------------------------ |
| Connection lifecycle + reconnect | Closure state inside `web/js/ws-client.js`       |
| URL form + persistence           | Closure state inside `web/js/config-panel.js`    |
| LED / motor widget state         | Closure state inside `web/js/control-panel.js`   |
| Inbound frame routing            | `main.js` callbacks (`onFrame`, `onStatus`, …)   |

For the ownership rules and the callback-injection wiring style, see
[`./quality-guidelines.md`](./quality-guidelines.md) §"Required Patterns" and
[`./state-management.md`](./state-management.md).

---

## When this file becomes relevant

Only if the PRD explicitly approves adopting a hook-based framework. At
that point, this file should be re-filled from the chosen framework's
conventions.

Until then, treat any `import` of a framework runtime in `web/js/` as a
code-review blocker.
