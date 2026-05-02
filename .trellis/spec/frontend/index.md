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
- Reserved placeholders log `console.info('[placeholder] ...')`, never throw
- Page locked to `100vh` with `overflow: hidden`, no horizontal scroll
- `npm run lint` and `npm run format:check` pass; `npm test` smoke is green

---

## Guidelines Index

| Guide                                              | Description                                                | Status     |
| -------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| [Quality Guidelines](./quality-guidelines.md)      | Module signatures, contracts, validation matrix, decisions | **Filled** |
| [Directory Structure](./directory-structure.md)    | Module organization and file layout                        | To fill    |
| [Component Guidelines](./component-guidelines.md)  | Component patterns (N/A while no framework)                | Deferred   |
| [Hook Guidelines](./hook-guidelines.md)            | Custom hooks (N/A while no framework)                      | Deferred   |
| [State Management](./state-management.md)          | Local state and persistence patterns                       | To fill    |
| [Type Safety](./type-safety.md)                    | Type patterns, JSDoc, runtime validation                   | To fill    |

> "Deferred" means the topic does not apply to this project's current
> stack (native ESM, no framework, no hooks). Revisit only if the stack
> changes.

---

**Language**: All documentation should be written in **English**.
