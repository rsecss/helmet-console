# Component Guidelines

> **Status: Deferred** — this project has no UI framework.

---

## Why

The frontend is **native browser ESM with no framework** (no React / Vue /
Svelte / Lit). See the locked design constraints in
[`./quality-guidelines.md`](./quality-guidelines.md) §"Frontend-Specific Hard
Constraints":

> - **Native ES Modules** — no build tool
> - **No framework** — no React / Vue / Svelte
> - **JS and CSS as separate files**

There are no components in the framework sense. The unit of reuse is a
**factory function** (`createXxxPanel({...deps})`) defined in `web/js/`, and
the unit of styling is a CSS class in `web/css/style.css` driven by
`data-state` / `data-variant` / `aria-pressed` attributes.

For factory-function patterns, props (callback) conventions, and DOM
ownership rules, read
[`./quality-guidelines.md`](./quality-guidelines.md) §"Required Patterns" —
that section already documents:

- Module signatures (`createWsClient`, `createConfigPanel`,
  `createCommandPanel`, `createControlPanel`, `createConsoleTerminal`)
- Module ownership table (who may write `.app-shell[data-state]`, who may
  call `client.send`, etc.)
- Reserved-placeholder pattern for un-implemented DOM slots

For directory layout and where new modules go, see
[`./directory-structure.md`](./directory-structure.md).

---

## When this file becomes relevant

Only if the PRD explicitly approves adopting a UI framework. At that point,
this file should be re-filled from the chosen framework's conventions.

Until then, treat any `import` of a framework runtime in `web/js/` as a
code-review blocker.
