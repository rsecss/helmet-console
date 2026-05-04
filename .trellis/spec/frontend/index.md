# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains frontend development guidelines for the Helmet
Console `web/` UI. The console is a native browser ESM app with no build
tool, replicating `docs/design/prototype-rose.html` 1:1.

---

## Pre-Development Checklist

Before touching `web/`, read:

1. **`quality-guidelines.md`** — hard constraints, module boundaries,
   `parseWsUrl` contract, 3-state UI mapping, `console.ws.*` localStorage
   contract, reserved-placeholder pattern, design decisions
2. **`docs/design/prototype-rose.html`** — the visual surface of truth
3. **`docs/architecture.md` §2 + §5** — module diagram and connection
   state machine

---

## Quality Check

Before declaring frontend work done, verify against
`quality-guidelines.md` Code Review Checklist:

- `index.html` is structure only (no inline `<script>` body / `<style>`)
- All imports are relative under `web/js/` or `web/vendor/` (no CDN)
- `terminal.js` stays display-only (`disableStdin: true`, no `onData` sender)
- `config-panel.js` is the only writer of `.app-shell[data-state]` and
  `console.ws.*` localStorage keys
- `parseWsUrl` covers the 4 error reasons with the exact messages in the matrix
- Control widgets emit `cmd` only via injected callbacks (never `client.send`)
- Direction markers `[↓]` / `[↑]` exist only in `main.js`
  (`TX_PREFIX` / `RX_PREFIX`); never on the wire, never in `ws-cli.js`
  stdout (see `quality-guidelines.md` §"Why display-layer direction
  markers in the web xterm only")
- Reserved placeholders log `console.info('[placeholder] ...')`, never throw
- Page locked to `100vh` with `overflow: hidden`, no horizontal scroll
- `npm run lint` and `npm run format:check` pass; `npm test` smoke is green

---

## Guidelines Index

| Guide                                              | Description                                                | Status         |
| -------------------------------------------------- | ---------------------------------------------------------- | -------------- |
| [Quality Guidelines](./quality-guidelines.md)      | Module signatures, contracts, validation matrix, decisions | **Filled**     |
| [Directory Structure](./directory-structure.md)    | `web/` layout, module ownership, naming conventions        | **Filled**     |
| [State Management](./state-management.md)          | Closure / DOM attr / localStorage; 5→3 state collapse      | **Filled**     |
| [Type Safety](./type-safety.md)                    | JSDoc + runtime guards + ESLint (no TypeScript)            | **Filled**     |
| [Component Guidelines](./component-guidelines.md)  | Component patterns                                         | **Deferred**   |
| [Hook Guidelines](./hook-guidelines.md)            | Custom hooks                                               | **Deferred**   |

> "Deferred" means the topic does not apply to this project's current
> stack (native ESM, no framework, no hooks). Revisit only if the stack
> changes.

---

**Language**: All documentation should be written in **English**.
