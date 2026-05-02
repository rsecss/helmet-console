# Directory Structure

> How frontend code is organized.

---

## Overview

The frontend is a **native ESM browser app with no build tool**. It is a
1:1 visual replica of `docs/design/prototype-rose.html` and is loaded
directly by the browser via `<script type="module">`. See the locked design
constraints in [`./quality-guidelines.md`](./quality-guidelines.md)
§"Frontend-Specific Hard Constraints".

---

## Directory Layout

```text
web/
├── css/
│   └── style.css         # Single CSS entry — design tokens lifted from prototype-rose
├── js/
│   ├── main.js           # Composition: DOM lookup + callback wiring + reserved placeholders
│   ├── ws-client.js      # WebSocket transport + 5-state machine + heartbeat
│   ├── terminal.js       # xterm display-only wrapper (white floor, rose cursor)
│   ├── config-panel.js   # Single URL input + parseWsUrl + localStorage + .app-shell[data-state]
│   ├── command-panel.js  # Command textarea + send-enabled state
│   └── control-panel.js  # LED segmented toggle + motor slider with live --fill
├── vendor/
│   └── xterm/            # Vendored xterm + addon-fit; NEVER imported from CDN
├── favicon.svg
└── index.html            # Structure only — no inline <script> body / <style>
```

---

## Module Organization

The frontend follows **strict module boundaries**. The full ownership matrix
(who owns the WS object, who writes `data-state`, who writes
`localStorage`) is in [`./quality-guidelines.md`](./quality-guidelines.md)
§"Required Patterns" — read that before writing any module-level change.

In short:

| Module               | Owns                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `main.js`            | DOM lookup, callback wiring, reserved-placeholder `console.info`     |
| `ws-client.js`       | WebSocket connection, 5-state machine, heartbeat, send               |
| `terminal.js`        | xterm instance, `Terminal.write/writeln`, theme, resize              |
| `config-panel.js`    | URL form, `parseWsUrl`, localStorage, `.app-shell[data-state]` driver |
| `command-panel.js`   | Textarea submit and send-enabled state                               |
| `control-panel.js`   | LED `aria-pressed`/status text, motor slider with live `--fill`      |

> **Modules never import each other directly.** All wiring happens in
> `main.js` via injected callbacks (`onConnect`, `onSend`, `onLedOn`, …).
> See `web/js/main.js:20-86` for the canonical wiring example.

---

## Naming Conventions

- **Files**: kebab-case `.js` matching the module's role
  (`ws-client.js`, `config-panel.js`, `control-panel.js`).
- **Exported factories**: `createXxx({...deps})` returning `{ ... }`.
  Examples: `createWsClient`, `createConfigPanel`, `createCommandPanel`,
  `createControlPanel`, `createConsoleTerminal`.
- **Pure helpers exported alongside**: lowercase verb-first
  (`parseWsUrl` exported from `config-panel.js`).
- **Constants**: `UPPER_SNAKE` (`STORAGE_KEYS`, `STATE_VIEW`,
  `STATE_TO_DATA_STATE`, `RECONNECT_DELAYS`, `HEARTBEAT_MS`, `STALE_MS`).
- **No default exports** — always named exports.

DOM hooks:

- IDs (`appShell`, `wsUrl`, `commandForm`, …) are looked up **only** in
  `main.js` via `requireElement(id)`. Other modules never call
  `document.getElementById`.
- State attributes use `data-` (`data-state`, `data-variant`) and
  `aria-pressed` for toggles. CSS reads these attributes.

Imports are explicit:

```js
import { createConfigPanel } from './config-panel.js';        // sibling module
import { Terminal } from '../vendor/xterm/xterm.mjs';          // vendored library
```

`.js` / `.mjs` extensions are **required** for browser ESM resolution.

---

## Examples to Read First

When extending the frontend, mirror the structure of:

- **Adding a control widget**: `web/js/control-panel.js` — factory takes
  DOM nodes + callback, returns local-state setters; never touches
  `client.send` or `.app-shell[data-state]`.
- **Adding a localStorage key**: `web/js/config-panel.js` — must follow the
  `console.ws.*` namespace and be written **only** by `writeConfig` (single
  write path). See [`./state-management.md`](./state-management.md).
- **Adding a reserved DOM slot**: `web/js/main.js:93-117` — for plain
  icons use `reservePlaceholder(selector, label)`. For segmented toggles
  that need to mirror `aria-pressed` across siblings (e.g., AI 助手), keep
  a custom handler that flips siblings then calls
  `console.info('[placeholder] ...')`. Never half-implement.
