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
  machine), `terminal.js` (display-only xterm), `config-panel.js` (connection form
  + localStorage), `command-panel.js` (command input + send state); modules do not
  call each other directly, only via callbacks injected in `main.js`

The sections below capture additional frontend rules.
They will be filled as concrete code patterns emerge in P3 (`web/` MVP).

---

## Overview

Frontend code is native browser ESM with no build step. The UI follows a serial
assistant interaction model: the terminal is a receive/log display, and commands
are sent only from the command input panel.

Current frontend entry points:

- `web/index.html` — structure only; references CSS and ESM files
- `web/js/main.js` — composition and callback wiring
- `web/js/ws-client.js` — WebSocket state machine, heartbeat, send
- `web/js/terminal.js` — xterm display-only wrapper
- `web/js/config-panel.js` — connection fields and localStorage
- `web/js/command-panel.js` — command textarea and send button
- `web/css/style.css` — single CSS entry for the MVP

---

## Forbidden Patterns

- Do not add inline `<script>` bodies or `<style>` blocks to `web/index.html`.
- Do not import browser code from CDN URLs; vendor browser libraries under
  `web/vendor/`.
- Do not make `terminal.js` send user input. The terminal is display-only.
- Do not let feature modules instantiate each other directly. Wire modules in
  `main.js` through callbacks.
- Do not send commands from control widgets by bypassing `ws-client.js`.

---

## Required Patterns

### Scenario: Native ESM Serial Assistant UI

#### 1. Scope / Trigger

Any change to `web/index.html`, `web/js/*.js`, `web/css/style.css`, or the WS
frame contract must keep this section current.

#### 2. Signatures

```js
// web/js/ws-client.js
export function createWsClient({ onStatus, onFrame, onLog });
// returns { connect(url), disconnect(), send(frame), isConnected() }

// web/js/terminal.js
export function createConsoleTerminal({ container });
// returns { writeFrame(frame), writeLine(message), dispose() }

// web/js/config-panel.js
export function createConfigPanel({
  form,
  hostInput,
  portInput,
  pathInput,
  tlsInput,
  connectButton,
  disconnectButton,
  onConnect,
  onDisconnect,
});

// web/js/command-panel.js
export function createCommandPanel({ form, input, sendButton, onSend });
```

#### 3. Contracts

Module boundary:

| Module              | Owns                                   | Must not own                       |
| ------------------- | -------------------------------------- | ---------------------------------- |
| `main.js`           | DOM lookup, callback wiring            | WS state internals, xterm internals |
| `ws-client.js`      | Connection state, heartbeat, send      | DOM mutation, terminal rendering   |
| `terminal.js`       | `Terminal.write/writeln`, resize       | Command input, WebSocket sending   |
| `config-panel.js`   | Connection form and localStorage       | WS object, terminal object         |
| `command-panel.js`  | Textarea submit and send enabled state | WS object, terminal object         |

Command frame:

```js
{
  from: 'web',
  type: 'cmd',
  payload: commandText
}
```

Connection settings persist under:

- `console.ws.host`
- `console.ws.port`
- `console.ws.path`
- `console.ws.tls`

#### 4. Validation & Error Matrix

| Input / State           | Frontend behavior                                  |
| ----------------------- | -------------------------------------------------- |
| Disconnected            | Command input and send button disabled             |
| Connected               | Command input and send button enabled              |
| Blank command submit    | Focus textarea; do not send                        |
| Send while WS not open  | `ws-client.js` calls `onLog('[ws] not connected')` |
| Incoming invalid JSON   | `ws-client.js` calls `onLog('[ws] bad frame')`     |
| Incoming `type:"pong"`  | Update activity only; do not print to terminal     |
| Incoming non-pong frame | `main.js` forwards to `terminal.writeFrame(frame)` |

#### 5. Good / Base / Bad Cases

- Good: user connects, types `AT+PING` in the command textarea, clicks send;
  `main.js` sends `{ from:'web', type:'cmd', payload:'AT+PING' }` through
  `ws-client.js`, clears the textarea, and terminal remains display-only.
- Base: page loads disconnected with default host/port/path values and send
  disabled.
- Bad: typing inside the xterm hidden input must not send frames; `terminal.js`
  must keep `disableStdin: true` and register no `onData` sender.

#### 6. Tests Required

- Run `npm run lint` for module/import errors.
- Run `npm run format:check` for HTML/CSS/JS formatting.
- Browser manual check: reload page, verify command textarea is focused, terminal
  input is read-only, connect enables send, and console has no errors.

#### 7. Wrong vs Correct

Wrong:

```js
createConsoleTerminal({
  container,
  onData(data) {
    client.send({ from: 'web', type: 'cmd', payload: data });
  },
});
```

Correct:

```js
const commandPanel = createCommandPanel({
  form,
  input,
  sendButton,
  onSend(command) {
    client.send({ from: 'web', type: 'cmd', payload: command });
  },
});
```

---

## Testing Requirements

- Run `npm test` and `npm run format:check` before commit.
- Use Chrome DevTools snapshot/console checks for UI interaction changes.
- Keep browser-visible errors out of the console after reload and connect.

---

## Code Review Checklist

- Does `index.html` still contain structure only?
- Are all module imports relative and under `web/js/` or `web/vendor/`?
- Is xterm still display-only (`disableStdin: true`, no command-sending
  `onData`)?
- Does `command-panel.js` own command submission and connected enabled state?
- Are labels and controls visible in a single viewport without layout overflow?
