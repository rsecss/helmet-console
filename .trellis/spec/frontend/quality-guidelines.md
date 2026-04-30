# Quality Guidelines

> Code quality standards for frontend development.

---

## Project-Wide Conventions (Apply Here First)

Before reading the sections below, follow these project-level conventions
(applicable to backend and frontend alike):

- `docs/contributing.md` — branch policy, Conventional Commits, formatter toolchain, git hooks
- `docs/architecture.md` — system architecture, module boundaries, WS message protocol
- `.prettierrc.json` — formatter rules (single quote, semi, 100 cols, LF)
- `.editorconfig` — UTF-8 / LF / 2-space / final newline
- `.gitattributes` — enforces LF in working tree on all platforms

### Frontend-Specific Hard Constraints (locked during brainstorm)

These are non-negotiable design choices for `web/`:

- **Native ES Modules** — no build tool (no Vite / Webpack / Rollup)
- **No framework** — no React / Vue / Svelte
- **JS and CSS as separate files** — `index.html` contains no inline `<script>` body
  or `<style>` blocks; reference via `<script type="module" src="/js/...">` and
  `<link rel="stylesheet" href="/css/...">`
- **Vendor libraries under `web/vendor/`** — no CDN imports (offline-friendly)
- **Module boundaries** — `main.js` (assembly), `ws-client.js` (transport + state
  machine), `terminal.js` (xterm), `config-panel.js` (form + localStorage);
  modules do not call each other directly, only via callbacks injected in `main.js`

The sections below capture additional frontend rules.
They will be filled as concrete code patterns emerge in P3 (`web/` MVP).

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
