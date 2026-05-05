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
- **Module boundaries** — `main.js` (assembly + reserved-placeholder handlers),
  `ws-client.js` (transport + 5-state machine), `terminal.js` (display-only
  xterm), `config-panel.js` (single URL form + `parseWsUrl` + localStorage +
  `.app-shell[data-state]` mutation), `command-panel.js` (command textarea +
  send-enabled state), `control-panel.js` (LED segmented toggle + motor slider
  with live `--fill`), `view-switcher.js` (single writer of
  `.app-shell[data-view]` + `view-toggle aria-pressed` sync), `ai-panel.js`
  (DeepSeek chat + tool_calls translation + sole writer of `console.ai.*`);
  modules do not call each other directly, only via callbacks injected in
  `main.js`

The sections below capture the concrete frontend rules.

---

## Overview

Frontend code is native browser ESM with no build step. The UI follows a serial
assistant interaction model: the terminal is a receive/log display, and commands
are sent only from the command-panel textarea or the control-panel widgets —
both go through `main.js` callbacks into `ws-client.js`. The visual surface is a
1:1 replica of `docs/design/prototype-rose.html`.

Current frontend entry points:

- `web/index.html` — structure only; references CSS and ESM files
- `web/js/main.js` — composition, callback wiring, reserved-placeholder handlers
- `web/js/ws-client.js` — WebSocket 5-state machine, heartbeat, send
- `web/js/terminal.js` — xterm display-only wrapper (white floor + rose cursor)
- `web/js/config-panel.js` — single URL input + `parseWsUrl` + localStorage +
  `.app-shell[data-state]` driver
- `web/js/command-panel.js` — command textarea and send button
- `web/js/control-panel.js` — LED segmented toggle + motor slider with live
  `--fill`; emits `cmd` payloads through main.js callbacks
- `web/js/view-switcher.js` — single writer of `.app-shell[data-view]` and
  the `view-toggle aria-pressed` sync (terminal / ai)
- `web/js/ai-panel.js` — DeepSeek V4 chat panel; sole writer of
  `console.ai.*` localStorage; tool_calls translated to existing cmd frames
- `web/css/style.css` — single CSS entry; design tokens lifted from
  `docs/design/prototype-rose.html`

---

## Forbidden Patterns

- Do not add inline `<script>` bodies or `<style>` blocks to `web/index.html`.
- Do not import browser code from CDN URLs; vendor browser libraries under
  `web/vendor/`.
- Do not make `terminal.js` send user input. The terminal is display-only.
- Do not let feature modules instantiate each other directly. Wire modules in
  `main.js` through callbacks.
- Do not send commands from control widgets by bypassing `ws-client.js`.
- Do not mutate `.app-shell[data-state]` from any module other than
  `config-panel.js`. The page-level state attribute is the single source of
  truth for the 3-state UI surface and is owned by `applyView()`.
- Do not write to `console.ws.*` `localStorage` keys outside
  `config-panel.js#writeConfig`. The single write path is `parseWsUrl()` →
  `writeConfig()`; reading from elsewhere is fine.
- Do not register reserved-interface handlers that throw or that move beyond a
  `console.info('[placeholder] <label> not implemented yet')` plus the local
  visual toggle (e.g., `aria-pressed`).
- Do not toggle visibility through the HTML `[hidden]` attribute on an element
  whose class sets an explicit `display: flex | grid | block`. Author-defined
  `display` rules win against the UA stylesheet's `[hidden] { display: none }`,
  so the element stays visible. Either drop the explicit `display`, or pair the
  class with a `.x[hidden] { display: none }` selector. Affected today:
  `.ai-config-bar`, `.ai-config-form`, `.ai-bubbles` — see `web/css/style.css`.

---

## Required Patterns

### Scenario: Native ESM Serial Assistant UI (rose-themed)

#### 1. Scope / Trigger

Any change to `web/index.html`, `web/js/*.js`, `web/css/style.css`, the WS
frame contract, or the visual surface (which mirrors
`docs/design/prototype-rose.html`) must keep this section current.

#### 2. Signatures

```js
// web/js/ws-client.js
export function createWsClient({ onStatus, onFrame, onLog });
// returns { connect(url), disconnect(), send(frame), isConnected() }
// onStatus({ name, detail }) where name ∈
//   'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

// web/js/terminal.js
export function createConsoleTerminal({ container });
// returns { writeText(text), writeLine(message), dispose() }
// xterm theme: background '#ffffff', cursor '#dc2626' (rose), GitHub-Light ANSI

// web/js/config-panel.js
export function createConfigPanel({
  shell, // .app-shell — receives [data-state] mutations
  form, // <form> wrapping the connection bar
  urlInput, // single text input for ws://host:port/path
  statusPill, // <span> for "未连接 / 已连接 / 错误" with [data-variant]
  actionButton, // context-sensitive: 连接 / 断开连接 / 重试
  inlineError, // <p> for error message text
  onConnect, // (normalizedUrl: string) => void
  onDisconnect, // () => void
});
// returns { setStatus({ name, detail }) }

// Pure helper, exported for tests/reuse:
export function parseWsUrl(raw);
// returns
//   { ok: true, host, port, path, tls, normalized }
// | { ok: false, reason }

// web/js/command-panel.js
export function createCommandPanel({ form, input, sendButton, onSend });
// returns { setConnected(isConnected: boolean) }

// web/js/control-panel.js
export function createControlPanel({
  ledOnButton,
  ledOffButton,
  ledStatus, // .led-status — receives [data-state='off'|'white'|'red'|'green']
  ledStatusValue, // text node for "已关闭 / 白光 / 红光 / 绿光"
  motorOnButton, // segmented switch [开]
  motorOffButton, // segmented switch [关]
  motorGearButtons, // Array<HTMLButtonElement> with data-gear="1|2|3"
  motorDisplay, // .motor-display — receives [data-state='on'|'off']
  motorStateValue, // text node for "运行中 / 已停止"
  motorGearValue, // text node for the current gear ("1" | "2" | "3")
  onLedOn, // () => void
  onLedOff, // () => void
  onMotorSpeed, // (n: number) => void  — n in [0..3]
});
// returns {
//   setLedState(state), // state ∈ 'off' | 'white' | 'red' | 'green'
//   setMotorSpeed(n),
//   snapshot(), // { led, motorOn, motorGear }
// }
```

#### 3. Contracts

**Module boundary**:

| Module               | Owns                                                                 | Must not own                       |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| `main.js`            | DOM lookup, callback wiring, reserved-placeholder `console.info`     | WS state internals, xterm internals |
| `ws-client.js`       | Connection 5-state machine, heartbeat, send                          | DOM mutation, terminal rendering   |
| `terminal.js`        | `Terminal.write/writeln`, resize, theme                              | Command input, WebSocket sending   |
| `config-panel.js`    | URL form, `parseWsUrl`, localStorage, `.app-shell[data-state]`       | WS object, terminal object         |
| `command-panel.js`   | Textarea submit and send-enabled state                               | WS object, terminal object         |
| `control-panel.js`   | LED `aria-pressed`/status text, motor slider with live `--fill`      | WS object, `.app-shell[data-state]` |
| `view-switcher.js`   | `.app-shell[data-view]` + `view-toggle aria-pressed` sync            | WS object, terminal object, business state |
| `ai-panel.js`        | DeepSeek fetch + SSE + tool_call dispatch + `console.ai.*` localStorage + AI bubbles DOM | WS object (uses injected `onTool` + `isWsConnected`), `.app-shell[data-state]`, `.app-shell[data-view]` |

**3-state UI surface** — `config-panel.js` collapses the 5 internal `ws-client`
states onto 3 visual states (driven by `.app-shell[data-state]`):

| ws-client state | UI state (`data-state`) | Pill text | Pill variant   | Action      | Action variant | URL readonly | Action disabled |
| --------------- | ----------------------- | --------- | -------------- | ----------- | -------------- | ------------ | --------------- |
| disconnected    | `disconnected`          | 未连接    | `disconnected` | 连接        | `solid`        | no           | no              |
| connecting      | `disconnected`          | 未连接    | `disconnected` | 连接        | `solid`        | yes          | yes             |
| connected       | `connected`             | 已连接    | `connected`    | 断开连接    | `ghost`        | yes          | no              |
| reconnecting    | `error`                 | 错误      | `error`        | 重试        | `solid`        | no           | no              |
| error           | `error`                 | 错误      | `error`        | 重试        | `solid`        | no           | no              |

CSS reads `[data-state]` to dim `.control-cards` and `.command-bar` to 50%
opacity outside `connected`.

**Wire format**: every frame is a single UTF-8 text line ending in `\n`.
Server is a byte-passthrough — there is no JSON envelope. See
`docs/architecture.md` §4 (canonical) and `docs/interface.md`.

**Display-layer direction markers** (xterm only — wire is unchanged):
the web terminal prefixes every visible frame with a directional marker
so the operator can distinguish their own outgoing commands from
incoming peer frames (the relay does not echo a sender's own frame
back). Markers exist in the xterm display only and are never sent on
the wire, never written by `ws-cli.js`.

| Direction                       | Marker | ANSI      | Source constant (in `main.js`) |
| ------------------------------- | ------ | --------- | ------------------------------ |
| Browser → relay (outgoing/down) | `[↓]`  | red (31)  | `TX_PREFIX = '\x1b[31m[↓]\x1b[0m'` |
| Relay → browser (incoming/up)   | `[↑]`  | blue (34) | `RX_PREFIX = '\x1b[34m[↑]\x1b[0m'` |

The trailing `\x1b[0m` is part of the prefix so any device-side ANSI in
the body still renders normally. Marker constants live exclusively in
`main.js`; `terminal.js`, `ws-client.js`, `web/vendor/`, and
`server/scripts/ws-cli.js` must remain marker-agnostic. See the design
decision below for why ws-cli stays byte-faithful.

**Command frame** (free-form text via command-panel):

```js
client.send('<command text>\n');
```

Multi-line input from the command textarea is split on `\n` in `main.js`
before sending; each non-empty line becomes its own frame so devices
never need to handle frame boundaries.

**Control frames** (LED + motor via control-panel / AI tool → main.js `sendCommand`):

```js
// LED on / off
client.send('led_on\n'); // device resolves this to white
client.send('led_off\n');
client.send('led_color_red\n'); // color ∈ white | red | green
// Motor speed
client.send(`motor_speed_${value}\n`); // value ∈ [0..3]; 0 emitted by switch OFF, 1..3 by switch ON
// Best-effort state snapshot after every successful control send
client.send(`state:led=${led},motor=${motor}\n`); // led ∈ off|white|red|green; motor ∈ [0..3]
```

`control-panel.js` updates LED status text/dot **locally** based on click
intent (not device confirmation). Manual LED "开启" resolves to `white`,
matching the device-side `led_on -> WHITE` mapping. AI-issued
`led_color_<white|red|green>` updates the local mirror to that color via
`main.js#mirrorControlState` before `sendCommand()` emits the control
frame and `state:` snapshot. Future inbound `state:` parsing belongs in
`main.js#onFrame`, not in `ws-client.js` or `control-panel.js`.

**LocalStorage keys**:

`config-panel.js#writeConfig` is the **only writer** of `console.ws.*`:

| Key                | Type   | Source                                       |
| ------------------ | ------ | -------------------------------------------- |
| `console.ws.host`  | string | `parseWsUrl().host`                          |
| `console.ws.port`  | string | `parseWsUrl().port` (defaults: `80` / `443`) |
| `console.ws.path`  | string | `parseWsUrl().path` (default: `'/'`)         |
| `console.ws.tls`   | string | `'true'` if `wss:`, else `'false'`           |
| `console.ws.url`   | string | full normalized `ws[s]://host[:port]/path`   |

`ai-panel.js#writeAiConfig` is the **only writer** of `console.ai.*`:

| Key                  | Type   | Source                                                              |
| -------------------- | ------ | ------------------------------------------------------------------- |
| `console.ai.apiKey`  | string | DeepSeek API key (raw `sk-...`)                                     |
| `console.ai.baseUrl` | string | API base URL (default `https://api.deepseek.com`)                   |
| `console.ai.model`   | string | `deepseek-v4-flash` \| `deepseek-v4-pro` (validated against allow-list on read) |

Read order for prefilling the URL input on load: `console.ws.url` first; fall
back to recomposing from `host/port/path/tls` (backward compatible with
pre-rose multi-field forms); otherwise `defaultUrl()` derived from
`window.location`.

`ai-panel.js#readAiConfig` reads three keys with default fallbacks; the
`model` value is rejected if it is not in `SUPPORTED_MODELS` (defaults to
`deepseek-v4-flash`).

#### 4. Validation & Error Matrix

| Input / State                       | Frontend behavior                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| Disconnected                        | Command input and send button disabled; control-cards dimmed                     |
| Connected                           | Command input and send button enabled; control-cards full opacity                |
| Blank command submit                | Focus textarea; do not send                                                      |
| Send while WS not open              | `ws-client.js` calls `onLog('[ws] not connected')`                               |
| Incoming binary frame               | `ws-client.js` calls `onLog('[ws] dropped binary frame')`                        |
| Incoming `pong\n`                   | Update activity only; do not print to terminal                                   |
| Incoming non-pong text              | `main.js#onFrame` writes `${RX_PREFIX}${body}` via `terminal.writeText`; `body` is the byte-passthrough text with a guaranteed trailing `\n` |
| Outgoing command (cmd / control / ai-tool) | `main.js#sendCommand` calls `client.send(<text>\n)`; if the call returns `true`, write `${TX_PREFIX}${command}\n` via `terminal.writeText`; on `false`, no echo (ws-client already emits `[ws] not connected`) |
| Outgoing control / ai-tool command success | `main.js#emitStateSnapshot` immediately sends `state:led=<off|white|red|green>,motor=<0..3>\n` and echoes it with `${TX_PREFIX}`; this frame is best-effort and uses `controlPanel.snapshot()` |
| Manual LED 开启                    | `control-panel.js` sets local LED state to `white`, emits `led_on\n`, then `main.js` emits `state:led=white,motor=<current>\n` |
| AI `led_color` tool                | `main.js#mirrorControlState` sets local LED state to the requested color before `sendCommand`, so the following `state:` frame reflects post-command state |
| URL input empty                     | `parseWsUrl` → `{ok:false, reason:'请输入连接地址'}`; inline error; keep focus   |
| URL input not parseable as URL      | reason: `'无法解析 URL，请使用 ws:// 或 wss:// 开头的完整地址'`                   |
| URL protocol not `ws:` / `wss:`     | reason: `'协议必须是 ws:// 或 wss://'`                                           |
| URL hostname empty                  | reason: `'主机名不能为空'`                                                       |
| `data-state` ≠ `connected`          | `.control-cards` and `.command-bar` dimmed to 50% opacity (CSS-driven)           |
| Reserved-interface click            | `console.info('[placeholder] <label> not implemented yet')`; no throw, no fetch |
| `defaultUrl()` with explicit `window.location.port` | Pass through verbatim (e.g. `http://127.0.0.1:8080/` → `ws://127.0.0.1:8080/ws`) |
| `defaultUrl()` no port + reverse-proxied origin (`https://example.com`) | Use scheme-standard port (443/wss, 80/ws); never fall back to `:8080`            |
| `defaultUrl()` no port + bare local origin (`127.0.0.1` / `localhost`) | Default to `:8080` for the dev workflow                                          |

#### 5. Good / Base / Bad Cases

- **Good (connect)**: user types `wss://device.local:8443/ws`, clicks 连接;
  `parseWsUrl` returns ok; `writeConfig` persists 5 keys; pill turns green
  with text 已连接; button becomes 断开连接; `.app-shell[data-state]` is
  `connected`; control-cards and command-bar regain full opacity. Reload
  prefills the URL from `console.ws.url`.
- **Good (cmd)**: with `data-state='connected'`, user types `AT+PING` and
  clicks 发送; `main.js` sends the text frame `'AT+PING\n'`, textarea
  clears, terminal stays display-only.
- **Good (control)**: user clicks LED 开启; `control-panel.js` sets
  `aria-pressed='true'`, status text "白光", `.led-status[data-state='white']`,
  and emits `'led_on\n'` via the injected `onLedOn` callback. `main.js`
  then emits `state:led=white,motor=<0..3>\n` as a best-effort snapshot.
- **Good (AI color)**: AI emits `led_color({color:'red'})`; `ai-panel.js`
  translates it to `'led_color_red'`; `main.js#mirrorControlState` updates
  the local LED mirror to `red` before `sendCommand`; terminal shows both
  `[↓]led_color_red` and `[↓]state:led=red,motor=<0..3>`.
- **Base**: page loads disconnected; action button shows 连接; command-bar
  and control-cards at 50% opacity; xterm mounted with `#ffffff` background
  and `#dc2626` cursor; placeholder buttons present but no console errors.
- **Bad (storage bypass)**: writing to `localStorage.console.ws.*` from
  outside `writeConfig` causes drift between the URL field and persisted
  state on next reload.
- **Bad (state-attr bypass)**: mutating `.app-shell[data-state]` from
  `control-panel.js` or `command-panel.js` makes the
  dim-outside-`connected` rule break silently and desyncs button text.
- **Bad (terminal echo)**: registering an `onData` callback on the xterm
  instance to forward keystrokes; `terminal.js` must keep
  `disableStdin: true` and remain display-only.
- **Bad (placeholder leak)**: a reserved-interface handler that triggers
  a real fetch / state mutation instead of `console.info`. It silently
  fires partially-implemented behavior on QA passes.
- **Bad (defaultUrl over-default)**: hard-coding `port || '8080'` in
  `defaultUrl()` mis-targets reverse-proxied deployments — an `https://`
  origin on standard `:443` (CF + nginx + frp) would emit
  `wss://example.com:8080/ws`, pointing the upstream at a non-existent
  port. Use scheme-standard ports when `window.location.port` is empty,
  and only fall back to `:8080` for bare local origins.

#### 6. Tests Required

- Run `npm run lint` for module/import errors.
- Run `npm run format:check` for HTML/CSS/JS formatting.
- Run `npm test` (lint + smoke) — confirms HTTP `/healthz` and WS broadcast
  still work.
- Browser / MCP manual check (the 3 visual states):
  1. **Reload disconnected** → pill 未连接 (gray), button 连接, control-cards
     and command-bar at 50% opacity, no console errors.
  2. **Click 连接 (server up)** → pill 已连接 (green), button 断开连接,
     opacity restored, send button enables, terminal stays read-only.
  3. **Stop server / submit bad URL** → pill 错误 (red), button 重试,
     inline error text shows, control-cards and command-bar dim again.
- **Reserved-placeholder check**: click 文档 / 终端侧栏 / 复制 / 全屏;
  expect exactly one `console.info('[placeholder] ...')` per click and
  zero exceptions. The AI 助手 button now switches to the real AI panel
  (no `[placeholder]` log expected).
- **localStorage check**: after a successful connect, read all 5
  `console.ws.*` keys in DevTools — values should be self-consistent
  (host/port/path/tls/url derived from the same parsed URL).

#### 7. Wrong vs Correct

**Wrong (terminal owns sending)**:

```js
createConsoleTerminal({
  container,
  onData(data) {
    client.send(`${data}\n`);
  },
});
```

**Correct**:

```js
const commandPanel = createCommandPanel({
  form,
  input,
  sendButton,
  onSend(command) {
    client.send(`${command}\n`);
  },
});
```

**Wrong (control-panel owns state attribute)**:

```js
// In control-panel.js — leaks page-level state ownership
ledOnButton.addEventListener('click', () => {
  document.getElementById('appShell').dataset.state = 'connected';
  onLedOn();
});
```

**Correct**:

```js
// control-panel.js never touches .app-shell.
// config-panel.js owns the data-state attribute via applyView(state).
ledOnButton.addEventListener('click', () => {
  setLedState(true);
  onLedOn();
});
```

**Wrong (raw localStorage write)**:

```js
// In main.js or any module that isn't config-panel
localStorage.setItem('console.ws.host', '127.0.0.1');
localStorage.setItem('console.ws.port', '8080');
// → drifts from console.ws.url; next reload prefill is inconsistent
```

**Correct**:

```js
// Only config-panel.js#writeConfig writes these keys, and only after a
// successful parseWsUrl(). Everyone else just reads.
const parsed = parseWsUrl(urlInput.value);
if (parsed.ok) {
  writeConfig(parsed); // sets host/port/path/tls/url atomically
  onConnect(parsed.normalized);
}
```

---

### Scenario: Reserved-Interface Placeholder Handlers

#### 1. Scope / Trigger

When a feature is approved by PRD but **not yet implemented** (currently:
文档, 终端侧栏, 复制, 全屏), reserve the DOM slot now and defer the
behavior. New reserved features should follow this exact pattern.

#### 2. Signatures

```js
// In main.js
function reservePlaceholder(selector, label) {
  document.querySelectorAll(selector).forEach((node) => {
    node.addEventListener('click', () => {
      console.info(`[placeholder] ${label} not implemented yet`);
    });
  });
}
```

#### 3. Contracts

| Element                            | Selector                                | Label    |
| ---------------------------------- | --------------------------------------- | -------- |
| Topbar 文档 icon                   | `.icon-btn[data-action='docs']`         | 文档     |
| Topbar 终端侧栏 icon               | `.icon-btn[data-action='sidebar']`      | 终端侧栏 |
| Terminal card 复制 icon            | `.icon-btn[data-action='copy']`         | 复制     |
| Terminal card 全屏 icon            | `.icon-btn[data-action='expand']`       | 全屏     |

`console.info` is the only side effect — no fetch, no state mutation, no
exception. The AI 助手 view toggle is no longer a placeholder; it now
flips the real `view-switcher.js` between `terminal` and `ai`.

#### 4. Validation & Error Matrix

| Action                           | Behavior                                                  |
| -------------------------------- | --------------------------------------------------------- |
| Click any reserved placeholder   | One `console.info('[placeholder] ...')`; no throw         |
| Click during disconnected/error  | Same as connected — placeholder is state-independent      |

#### 5. Good / Base / Bad

- **Good**: clicking 文档 logs once and does nothing else.
- **Bad**: a placeholder handler that triggers a partial fetch or mutates
  shared state; on QA the partial behavior gets mistaken for a bug.

#### 6. Tests Required

- Manual: click each reserved button once, confirm one `console.info`
  line per click and zero exceptions.

#### 7. Wrong vs Correct

**Wrong**:

```js
docsBtn.addEventListener('click', async () => {
  // Half-implementing while "reserved"
  const html = await fetch('/docs').then((r) => r.text());
  panel.innerHTML = html;
});
```

**Correct**:

```js
reservePlaceholder('.icon-btn[data-action="docs"]', '文档');
```

---

## Design Decisions

### Why a single URL input over multi-field host/port/path/tls?

**Context**: The pre-rose form had 4 separate inputs. The rose prototype
collapses them to one monospaced URL field.

**Decision**: Use a single `ws://host:port/path` input parsed via the pure
helper `parseWsUrl()`. Persist the parsed components plus the normalized URL
under existing `console.ws.*` keys for backward compatibility.

**Why**: One input matches the prototype, removes 3 fields of visual noise,
and makes copy-paste from a deployment doc trivial. Persistence stays
backward compatible so older sessions still prefill correctly.

### Why 3 visual states instead of 5?

**Context**: `ws-client.js` has a 5-state lifecycle (`disconnected`,
`connecting`, `connected`, `reconnecting`, `error`). The rose prototype
shows only 3 pill variants.

**Decision**: Keep the 5 internal states, but `config-panel.js#applyView`
collapses them onto 3 `.app-shell[data-state]` values
(`disconnected` / `connected` / `error`). The mapping table in §3 is the
contract.

**Why**: Internal state must stay rich so reconnect logic keeps working.
The user-facing surface should match the prototype exactly. Collapsing in
one place (`applyView`) means future changes to the visual surface don't
ripple into `ws-client.js`.

### Why placeholder DOM for unimplemented features?

**Context**: 文档, 终端侧栏, 复制, 全屏 are part of the rose design but
out of scope for the current iteration. (AI 助手 used to be in this list
and is now implemented as the real `ai-panel.js` module.)

**Decision**: Add the DOM with a `console.info` no-op handler now. Don't
half-implement.

**Why**: Reserving a DOM slot is cheaper than retrofitting markup later
when the surrounding layout has hardened. `console.info` lets QA verify
the slot exists and clearly distinguishes "reserved" from "broken".

### Why panel view + motor switch/gear two-axis (PRD 05-04-panel-view)

**Context**: The motor card was a 0..5 single-value slider rendered
alongside the LED card on every view. Two issues: (1) the controls
fought for vertical space against the terminal/AI 1fr row; (2) the
single value conflated "stopped" with "low speed". Future telemetry
display also needed a place to live.

**Decision**: Introduce a third `data-view='panel'` that owns LED +
motor + a reserved `.data-card` slot. Split motor state into two axes
— `switch:bool` (the power gate) and `gear:1..3` (the target speed).
Wire stays the existing flat string `motor_speed_<0..3>`; switch OFF
emits `motor_speed_0`, switch ON emits `motor_speed_<gear>`. While
switch is OFF, clicking a gear button only updates in-memory state
(passive memory) — no frame is sent.

**Why**: Aligns the protocol surface with user mental model
("ignition + transmission"); narrowing 0..5 → 0..3 reflects actual
device capability without any backend churn (relay stays
byte-pass-through). Passive memory prevents accidental motor start
when pre-selecting a gear before powering on. The `.data-card`
placeholder reserves layout space so the future telemetry/chart
integration doesn't reflow neighboring controls.

**Extensibility**: To add real telemetry, parse incoming frames in
`client.onFrame`, route recognized verbs (e.g. `telemetry rpm 1234`)
to a chart widget, and replace the `.data-card` placeholder. See
`spec/backend/quality-guidelines.md` §Telemetry (Deferred).

### Why display-layer direction markers in the web xterm only (not ws-cli)

**Context**: The relay does not loop a sender's own frame back (see
`spec/backend/quality-guidelines.md` §3 "client A does not receive its
own frame"). For interactive console use, an operator types a command
in the web command-bar and gets no terminal feedback that anything
went out — the only proof is a peer (the device or another browser)
echoing back, which the device is not obliged to do. The same
"silence after submit" applies on `server/scripts/ws-cli.js`.

**Decision**: Add direction markers (`[↓]` red for outgoing, `[↑]`
blue for incoming) only in the web xterm, emitted exclusively by
`main.js` (`TX_PREFIX` / `RX_PREFIX`). Keep `ws-cli.js` strictly
byte-passthrough on stdout per the backend `quality-guidelines.md`
§Dev-Side WS CLI Client §3 ("never trim, prefix, or annotate"). The
wire and the relay are untouched.

**Why split the two ends**:

1. ws-cli's contract is "play a dumb device peer". Tooling such as
   `... | node server/scripts/ws-cli.js > logs/ws-cli.log` requires
   stdout to be byte-faithful so the log can be diff'd against the
   frame the other end claims to have sent. Markers would silently
   break that test path (backend §6 manual test plan).
2. The web xterm is a human-facing display surface; the relay's
   no-echo rule is a usability problem only for humans. Local echo
   plus a distinct color/glyph per direction is the cheapest fix and
   stays inside the display layer.
3. Wire format and relay code are untouched — adding, removing, or
   recoloring markers in the future never requires a relay or
   protocol change.

**Implementation seam**: only `main.js` knows about markers. To
change glyph or color, edit `TX_PREFIX` / `RX_PREFIX`. To add a
"raw view" toggle in the future, gate the writes inside
`sendCommand` and `onFrame` on a flag — do **not** push marker logic
into `ws-client.js`, `terminal.js`, or `ws-cli.js`.

**Common Mistakes**:

- Echo on `client.send` regardless of return value. The boolean is
  the contract — `false` means the WS is not OPEN and ws-client has
  already logged `[ws] not connected`. A second echo there fakes
  delivery and is a worse UX than silence.
- Wrap the marker into the `client.send(...)` argument. Marker bytes
  on the wire break the byte-passthrough contract (`spec/backend/
  quality-guidelines.md` §Forbidden Patterns) and would also confuse
  any downstream device parser.
- Add the same markers to `ws-cli.js`. Breaks `> log` redirection
  used in backend §6 manual test plan; CI / scripts that diff log
  bytes against wire bytes silently fail.

---

### Scenario: AI Panel + DeepSeek Integration

#### 1. Scope / Trigger

Any change to `web/js/ai-panel.js`, the AI tool schema, the `console.ai.*`
localStorage namespace, the `data-view` switching contract, or the
mapping from AI `tool_calls` to existing cmd payloads must keep this
section current.

#### 2. Signatures

```js
// web/js/view-switcher.js
export function createViewSwitcher({ shell, buttons });
// returns { setView(name: 'terminal' | 'ai' | 'panel') }

// web/js/ai-panel.js
export function createAiPanel({
  configBar, configKey, configModel, configEdit,
  configForm, configFormTitle, keyInput, baseUrlInput, configCancel,
  bubbles, inputForm, input, sendButton,
  onTool,           // (payload: { action, value? }) => void
  isWsConnected,    // () => boolean
});
// returns { focus() }
```

#### 3. Contracts

**Tool name → command translation** (must match `control-panel.js` cmd shapes):

| AI tool name  | tool arguments         | command string (no trailing newline)    |
| ------------- | ---------------------- | --------------------------------------- |
| `led_on`      | `{}`                   | `'led_on'`                              |
| `led_off`     | `{}`                   | `'led_off'`                             |
| `motor_speed` | `{ value: 0..3 }` (int)| `` `motor_speed_${value}` ``            |

`main.js` injects `onTool(command)` that:
1. Calls `sendCommand(command)` (appends `\n`, hits ws-relay → MCU)
2. Mirrors the device-side change to control-card UI by parsing the
   verb prefix:
   - `'led_on'` → `controlPanel.setLedState(true)`
   - `'led_off'` → `controlPanel.setLedState(false)`
   - starts with `'motor_speed_'` → `controlPanel.setMotorSpeed(<parsed value>)`

**SSE protocol**: standard OpenAI streaming over `POST {baseUrl}/chat/completions`.
Events separated by `\r?\n\r?\n`. `data:` lines within an event are joined
by `\n` before `JSON.parse`. `data: [DONE]` terminates. tool_calls deltas
accumulate by `index` per OpenAI spec — concatenate `function.arguments`
strings then `JSON.parse` once on stream end.

**Request body** (constants in `ai-panel.js`):
```js
{
  model: <SUPPORTED_MODELS>,         // 'deepseek-v4-flash' | 'deepseek-v4-pro'
  messages: [{ role:'system', content: SYSTEM_PROMPT }, ...history],
  tools: TOOLS,                       // OpenAI tools format with led_on/led_off/motor_speed
  stream: true,
  thinking: { type: 'disabled' },     // hardcoded; not user-toggleable
}
```

**History strategy** (per PRD D8 strategy i): assistant messages stored
in `history` carry only `{ role, content }`. The `tool_calls` field is
NOT persisted. When a turn produces only tool_calls (empty content), an
assistant message with `content: ''` is still pushed so OpenAI's
user→assistant→user invariant holds.

**`data-view` switching**: `view-switcher.js` is the SOLE writer of
`.app-shell[data-view]`. Three valid values: `'terminal'` (default), `'ai'`,
and `'panel'`. CSS hides `.ai-card` and `.panel-view` in `'terminal'`; hides
`.terminal-card`, `.command-bar`, and `.panel-view` in `'ai'`; hides
`.terminal-card`, `.command-bar`, and `.ai-card` in `'panel'`. The
`.app-shell` grid (`auto auto 1fr auto`) auto-flows remaining visible
children, keeping whichever section is visible in the `1fr` row. The
`.panel-view` owns LED + motor cards plus the reserved `.data-card`
telemetry slot — these are NOT visible in `'terminal'` / `'ai'`.

#### 4. Validation & Error Matrix

| Condition                             | UI behavior                                         |
| ------------------------------------- | --------------------------------------------------- |
| `console.ai.apiKey` empty             | Empty-state config form; bubbles + input hidden     |
| `console.ai.model` invalid value       | `readAiConfig` falls back to `deepseek-v4-flash`    |
| HTTP 401                              | Red system bubble: `API Key 无效，请检查配置`        |
| HTTP 429                              | Red system bubble: `请求过于频繁，请稍后重试`        |
| HTTP 5xx                              | Red system bubble: `DeepSeek 服务异常 (HTTP <s>)`   |
| Network / stream-mid failure          | Red system bubble: `网络连接失败，请检查网络`       |
| `isWsConnected()` false on tool_call  | Tool line badge `⚠ 设备未连接`; `onTool` NOT called |
| Unknown tool name                     | Tool line badge `⚠ 未知工具 <name>`                 |
| Tool arguments JSON parse fail        | Tool line badge `⚠ 参数解析失败`                    |
| `motor_speed.value` out of `0..3`     | Tool line badge `⚠ 参数越界`; `onTool` NOT called   |
| Sending while streaming               | Submit handler short-circuits; input/send disabled  |
| Reload                                | History cleared; `console.ai.*` (3 keys) preserved  |

#### 5. Good / Base / Bad

- **Good (translate)**: `data-view='ai'`, key configured, ws connected,
  user types `把灯打开`. AI streams `好的，已为你打开 LED`, finishes with
  tool_calls=`led_on`. ai-panel calls `onTool('led_on')`,
  control-card shows `已开启`, the text frame `'led_on\n'` reaches MCU.
- **Good (no key)**: fresh load, click AI tab. Empty-state form shows
  `🤖 配置 DeepSeek API Key 启用对话` with password input + url input +
  保存. After save, switch to chat view; reload preserves `console.ai.*`.
- **Bad (ws-bypass)**: `ai-panel.js` directly imports `ws-client.js` to
  call `client.send`. Breaks module boundary; tool execution becomes
  non-mockable from main.js.
- **Bad (state attr leak)**: `ai-panel.js` mutates `.app-shell[data-view]`
  to switch back to terminal after a fatal error. Steals `view-switcher`'s
  ownership of the page-level state.
- **Bad (history leak)**: assistant `tool_calls` field persists into the
  next request. OpenAI requires the next message to be `role:'tool'`,
  which we do not send (PRD D8 i strategy), so the next request 400s.

#### 6. Tests Required

- Manual: with valid key + ws-up, send `把灯打开` → LED card flips to 已开启
- Manual: with valid key + ws-down, send `把灯打开` → tool line shows `⚠ 设备未连接`
- Manual: invalid key (e.g. `sk-invalid`) → red system bubble with 401 message
- Manual: switch view-toggle to AI then back; layout stays single-viewport, no console errors
- Manual: reload → key + baseUrl + model preserved; bubbles cleared

#### 7. Wrong vs Correct

**Wrong (ai-panel imports ws-client)**:

```js
// web/js/ai-panel.js — leaks WS dependency
import { wsClient } from './ws-client.js';
// ... when tool_call arrives:
wsClient.send('led_on\n');
```

**Correct**:

```js
// web/js/ai-panel.js — receives capability via injection
export function createAiPanel({ /* ... */ onTool, isWsConnected }) {
  // ... when tool_call is ready:
  if (!isWsConnected()) { /* render warning */ return; }
  onTool(translatedPayload);
}
// web/js/main.js wires onTool → sendControl + controlPanel.setXxx
```

**Wrong (history retains tool_calls)**:

```js
// next request would 400 because there's no follow-up role:'tool' message
history.push({ role: 'assistant', content, tool_calls: accumulatedTools });
```

**Correct**:

```js
history.push({ role: 'assistant', content }); // tool_calls dropped
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
- Does `main.js#sendCommand` echo `${TX_PREFIX}${command}\n` (red `[↓]`)
  via `terminal.writeText` **only** when `client.send` returns `true`?
- Does `main.js#onFrame` prefix non-pong incoming text with `${RX_PREFIX}`
  (blue `[↑]`) and ensure a trailing `\n` before writing to the terminal?
- Are `TX_PREFIX` / `RX_PREFIX` defined exclusively in `main.js`, with no
  marker bytes in `ws-client.js`, `terminal.js`, `ws-cli.js`, the relay,
  or any `client.send(...)` argument?
- Does `command-panel.js` own command submission and connected enabled state?
- Are labels and controls visible in a single viewport (`100vh`,
  `overflow: hidden`, no horizontal scroll)?
- Does `config-panel.js` remain the **only** writer of
  `.app-shell[data-state]`?
- Does `view-switcher.js` remain the **only** writer of
  `.app-shell[data-view]`?
- Does `config-panel.js#writeConfig` remain the **only** writer of
  `console.ws.*` `localStorage` keys?
- Does `ai-panel.js#writeAiConfig` remain the **only** writer of
  `console.ai.*` `localStorage` keys?
- Does `parseWsUrl` cover all four error reasons (empty / unparseable /
  bad protocol / empty hostname) with the exact messages in the matrix?
- Does `control-panel.js` route every cmd through the injected callback
  (no direct `client.send`, no `.app-shell` mutation)?
- Does `ai-panel.js` route every cmd through the injected `onTool`
  callback (no direct `client.send`, no `.app-shell` mutation)?
- Does `ai-panel.js` validate the `model` value read from localStorage
  against `SUPPORTED_MODELS` and fall back to the default?
- Does the AI history strategy keep only `{ role, content }` per assistant
  turn (drop `tool_calls`)?
- Does the SSE parser handle `\r?\n\r?\n` event separators and merge
  multiple `data:` lines per event?
- For any element toggled via `element.hidden = true/false`, does its class
  either avoid an explicit `display:` rule or pair it with a
  `.x[hidden] { display: none }` selector? (HTML5 `[hidden]` is overridden by
  any author `display: flex|grid|block`.)
- Do all reserved-interface buttons (文档 / 终端侧栏 / 复制 / 全屏) log
  `console.info('[placeholder] ...')` and not throw? (AI 助手 is no
  longer a placeholder.)
- Does the 3-state mapping table in §3 match `STATE_VIEW` and
  `STATE_TO_DATA_STATE` in `config-panel.js` byte-for-byte?
- Does the AI tool→command translation table match the strings emitted
  by `control-panel.js` byte-for-byte?
