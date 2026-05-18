# Frontend Quality Guidelines

> Executable contracts for the native browser ESM app under `web/`.
> Read together with [`./directory-structure.md`](./directory-structure.md)
> (file layout) and [`./state-management.md`](./state-management.md)
> (storage / data-flow rules).

---

## Hard Constraints (locked)

- **Native ES Modules** — no build tool (no Vite / Webpack / Rollup).
- **No framework** — no React / Vue / Svelte / Lit.
- **JS and CSS in separate files** — `index.html` is structure only;
  reference via `<script type="module">` and `<link rel="stylesheet">`.
- **Vendor libraries under `web/vendor/`** — no CDN imports.
- **Modules never import each other directly** — wiring lives in
  `main.js`; cross-module communication goes through injected callbacks.

---

## Forbidden Patterns

- Inline `<script>` body or `<style>` blocks in `index.html`.
- CDN imports for browser code.
- `terminal.js` sending user input (it stays display-only,
  `disableStdin: true`).
- Control widgets / AI panel calling `client.send` directly. Emit
  through injected callbacks; `main.js#sendCommand` is the single
  call site.
- Mutating `.app-shell[data-state]` outside `config-panel.js#applyView`.
- Mutating `.app-shell[data-view]` outside `view-switcher.js#setView`.
- Writing `console.ws.*` outside `config-panel.js#writeConfig`.
- Writing `console.ai.*` outside `ai-panel.js#writeAiConfig`.
- Reserved-placeholder handlers that throw or do real work — use
  `console.info('[placeholder] ...')` only.
- Toggling visibility via the HTML `[hidden]` attribute on an element
  whose CSS class sets explicit `display: flex|grid|block` —
  author-defined `display` wins over the UA `[hidden] { display: none }`,
  so the element stays visible. Either drop the explicit `display`, or
  pair the class with `.x[hidden] { display: none }`.

---

## Module Ownership

| Module             | Owns                                                                                | Must NOT touch                          |
| ------------------ | ----------------------------------------------------------------------------------- | --------------------------------------- |
| `main.js`          | DOM lookup, callback wiring, reserved placeholders, `TX_PREFIX` / `RX_PREFIX`       | WS state, xterm internals               |
| `ws-client.js`     | 5-state machine, heartbeat, send                                                    | DOM mutation, terminal rendering        |
| `terminal.js`      | xterm `write`/`writeln`, theme, resize                                              | Command input, WebSocket sending        |
| `config-panel.js`  | URL form, `parseWsUrl`, `console.ws.*`, `.app-shell[data-state]`                    | WS object, terminal object              |
| `command-panel.js` | Textarea submit, send-enabled state                                                 | WS object, terminal object              |
| `control-panel.js` | LED `aria-pressed` + status, motor switch/gear, `controlPanel.snapshot()`           | WS object, `.app-shell[data-state]`     |
| `view-switcher.js` | `.app-shell[data-view]` + `view-toggle aria-pressed`                                | WS object, terminal object              |
| `ai-panel.js`      | DeepSeek fetch + SSE, tool_call dispatch, AI bubbles, state-card, `console.ai.*`    | WS object, `.app-shell[data-state]/[data-view]` |
| `telemetry-panel.js` | MQ2 frame buffering / parsing, retention pruning, MQ2 trend SVG render, `.data-card[data-mq2-alarm]` | WS object, terminal object, command / control state |

---

## Module Signatures

```js
// web/js/ws-client.js
export function createWsClient({ onStatus, onFrame, onLog });
// returns { connect(url), disconnect(), send(frame), isConnected() }
// onStatus({ name, detail }), name ∈
//   'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

// web/js/terminal.js
export function createConsoleTerminal({ container });
// returns { writeText(text), writeLine(message), dispose() }
// xterm theme: background '#ffffff', cursor '#dc2626' (rose)

// web/js/config-panel.js
export function createConfigPanel({
  shell, form, urlInput, statusPill, actionButton, inlineError,
  onConnect,    // (normalizedUrl: string) => void
  onDisconnect, // () => void
});
// returns { setStatus({ name, detail }) }

export function parseWsUrl(raw);
// returns { ok: true, host, port, path, tls, normalized }
//       | { ok: false, reason }

// web/js/command-panel.js
export function createCommandPanel({ form, input, sendButton, onSend });
// returns { setConnected(isConnected: boolean) }

// web/js/control-panel.js
export function createControlPanel({
  ledOnButton, ledOffButton, ledStatus, ledStatusValue,
  motorOnButton, motorOffButton, motorGearButtons,
  motorDisplay, motorStateValue, motorGearValue,
  onLedOn, onLedOff, onMotorSpeed, // onMotorSpeed(n: 0..3)
});
// returns {
//   setLedState(state),         // 'off' | 'white' | 'red' | 'green'
//   setMotorSpeed(n),           // 0 → switch OFF (gear preserved); 1..3 → switch ON
//   snapshot(),                 // { led, motorOn, motorGear }
// }

// web/js/view-switcher.js
export function createViewSwitcher({ shell, buttons, onViewChange });
// returns { setView(name: 'terminal' | 'ai' | 'panel') }

// web/js/ai-panel.js
export function createAiPanel({
  configBar, configKey, configModel, configEdit,
  configForm, configFormTitle, keyInput, baseUrlInput, configCancel,
  bubbles, inputForm, input, sendButton,
  statusQueryButton,         // optional — manual "查询状态" trigger
  onTool,                    // (command: string) => void  (no trailing newline)
  isWsConnected,             // () => boolean
  getSnapshot,               // () => { led, motorOn, motorGear }
});
// returns { focus(), triggerStatusQuery() }

// web/js/telemetry-panel.js
export function parseTelemetryLine(line);
// returns { mq2: number, mq2Alarm: boolean } | null
//   null when: empty line, no `mq2=` key, mq2 not finite
//   ignores: unknown fields, malformed fields (no `=`, leading `=`)
//   `mq2_alarm` truthy iff value === '1'

export function createTelemetryPanel({ card, status, value, chart });
// returns { acceptFrame(text), snapshot() }
//   acceptFrame(text):
//     - buffers across calls; splits on /\r?\n/; only complete lines are parsed
//     - per-line parse → push { mq2, mq2Alarm, receivedAt: Date.now() }
//     - prune samples older than 90s, then re-render
//   snapshot(): shallow copy of current sample array (oldest first)
//   render side effects:
//     - card.dataset.mq2Alarm = 'true' | 'false' (latest sample's alarm)
//     - status.textContent = '烟雾异常' | '趋势正常'
//     - value.textContent = latest.mq2 (int if integral, else 1 decimal) | '--'
//     - chart.innerHTML = SVG (viewBox 0 0 640 320; clean=100, recovery=130, alarm=180)
```

---

## 3-State UI Surface

`config-panel.js` collapses the 5 internal `ws-client` states onto 3
visual states (`.app-shell[data-state]`):

| ws-client     | data-state     | Pill text  | Pill variant   | Action     | Action variant | URL readonly | Action disabled |
| ------------- | -------------- | ---------- | -------------- | ---------- | -------------- | ------------ | --------------- |
| disconnected  | `disconnected` | 未连接     | `disconnected` | 连接       | `solid`        | no           | no              |
| connecting    | `disconnected` | 未连接     | `disconnected` | 连接       | `solid`        | yes          | yes             |
| connected     | `connected`    | 已连接     | `connected`    | 断开连接   | `ghost`        | yes          | no              |
| reconnecting  | `error`        | 错误       | `error`        | 重试       | `solid`        | no           | no              |
| error         | `error`        | 错误       | `error`        | 重试       | `solid`        | no           | no              |

CSS reads `[data-state]` to dim `.control-cards` and `.command-bar` to
50% opacity outside `connected`. The mapping table must match
`STATE_VIEW` and `STATE_TO_DATA_STATE` in `config-panel.js` byte-for-byte.

---

## Wire & Display

Every frame is a single UTF-8 text line ending in `\n`. The relay is a
byte-passthrough with no JSON envelope. See `docs/architecture.md` §4
(canonical) and `docs/interface.md`.

### Display-Layer Direction Markers (xterm only)

The relay does not echo the sender's own frame, leaving the operator
without feedback that anything went out. The web xterm prefixes every
visible frame with a directional marker. Markers exist in xterm only;
the wire and `ws-cli.js` stay byte-faithful.

| Direction                       | Marker | ANSI      | Constant in `main.js` |
| ------------------------------- | ------ | --------- | --------------------- |
| Browser → relay (outgoing/down) | `[↓]`  | red (31)  | `TX_PREFIX`           |
| Relay → browser (incoming/up)   | `[↑]`  | blue (34) | `RX_PREFIX`           |

The trailing `\x1b[0m` is part of the prefix so any device-side ANSI in
the body still renders. Marker constants live exclusively in `main.js`;
`terminal.js`, `ws-client.js`, `web/vendor/`, and `ws-cli.js` must
remain marker-agnostic.

### Command Frames

```js
// Free-form (command-panel) — multi-line input split on \n in main.js
client.send('<command text>\n');

// Control (control-panel / AI tool) — flat verbs
client.send('led_on\n');                      // device resolves to white
client.send('led_off\n');
client.send('led_color_red\n');               // color ∈ white | red | green
client.send(`motor_speed_${value}\n`);        // value ∈ 0..3

// Best-effort UI snapshot after every successful control send
client.send(`state:led=${led},motor=${motor}\n`);
```

`control-panel.js` updates LED / motor UI **locally** based on click
intent (not device confirmation). AI-issued `led_color_<color>` calls
`mirrorControlState` in `main.js` *before* `sendCommand`, so the
following `state:` frame reflects the post-command state.

---

## Validation & Error Matrix

| Input / State                              | Behavior                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| Disconnected                               | Command input + send disabled; `.control-cards` / `.command-bar` dimmed           |
| Connected                                  | Inputs enabled; full opacity                                                      |
| Blank command submit                       | Focus textarea; do not send                                                       |
| Send while WS not OPEN                     | `ws-client.js` calls `onLog('[ws] not connected')`                                |
| Incoming binary frame                      | `ws-client.js` calls `onLog('[ws] dropped binary frame')`                         |
| Incoming `pong\n`                          | Update activity only; not written to terminal                                     |
| Incoming non-pong text                     | `main.js#onFrame` writes `${RX_PREFIX}${body}` (body has trailing `\n`)           |
| Incoming text with `mq2=<n>` field         | `telemetry-panel.js#acceptFrame` parses; valid samples pushed to ring, chart re-renders |
| Telemetry frame split across WS messages   | `telemetry-panel.js` buffers; lines emitted only on `\n`                          |
| Incoming line missing `mq2`                | Ignored by `telemetry-panel.js`; terminal still receives it via `main.js#onFrame` |
| Incoming `mq2=NaN` / unparseable value     | Ignored by `telemetry-panel.js`                                                   |
| Sample older than 90s                      | Pruned from ring on every new sample                                              |
| Latest sample has `mq2_alarm=1`            | `.data-card[data-mq2-alarm='true']`; status text `烟雾异常`; rose-colored curve   |
| Outgoing command (cmd / control / ai-tool) | `main.js#sendCommand`; on `client.send` true → `${TX_PREFIX}${command}\n`         |
| Successful control / ai-tool command       | `main.js#emitStateSnapshot` sends `state:led=…,motor=…\n` and echoes with TX_PREFIX |
| Manual LED 开启                            | `control-panel.js` sets local LED → `white`, emits `led_on\n`                     |
| AI `led_color({color})`                    | `mirrorControlState` sets local LED → color before `sendCommand`                  |
| URL empty                                  | `parseWsUrl` reason: `'请输入连接地址'`                                            |
| URL not parseable                          | reason: `'无法解析 URL，请使用 ws:// 或 wss:// 开头的完整地址'`                      |
| URL protocol ≠ `ws:`/`wss:`                | reason: `'协议必须是 ws:// 或 wss://'`                                              |
| URL hostname empty                         | reason: `'主机名不能为空'`                                                         |
| `defaultUrl()` with explicit `:port`       | Pass through (e.g. `http://127.0.0.1:8080/` → `ws://127.0.0.1:8080/ws`)           |
| `defaultUrl()` no port + reverse-proxied   | Use scheme-standard port (443/wss, 80/ws); never fall back to `:8080`             |
| `defaultUrl()` no port + bare local origin | Default to `:8080` for the dev workflow                                           |
| Reserved-placeholder click                 | One `console.info('[placeholder] <label>')`; no throw, no fetch                   |

---

## AI Panel + DeepSeek

### Tool → Command Translation

Mirror of `control-panel.js` cmd shapes. Mismatch breaks AI control.

| AI tool name  | Tool args              | Command string (no trailing `\n`)        |
| ------------- | ---------------------- | ---------------------------------------- |
| `led_on`      | `{}`                   | `'led_on'`                               |
| `led_off`     | `{}`                   | `'led_off'`                              |
| `led_color`   | `{ color: 'white'\|'red'\|'green' }` | `` `led_color_${color}` ``    |
| `motor_speed` | `{ value: 0..3 }` int  | `` `motor_speed_${value}` ``             |

`main.js` injects `onTool(command)` that:
1. Calls `mirrorControlState(command)` (local UI mirror before send).
2. Calls `sendCommand(command)` (appends `\n`, ws-relay → MCU,
   triggers state-snapshot emission).

### Device State Injection (per-turn)

`ai-panel.js` pulls the live snapshot via `getSnapshot()` and prepends
a system message `[当前设备状态] LED=…; 电机=…` *immediately before* the
trailing user message in every chat request. The system prompt
instructs the model to avoid no-op tool calls when state already matches.

After a tool round, `appendStateCard(bubble, snapshot, { wsConnected })`
appends a state card to the AI bubble; if `isWsConnected()` is false the
card carries a `⚠ 设备未连接，可能与实际不符` note. The optional
`statusQueryButton` triggers a state-card-only bubble without calling
DeepSeek.

### SSE Protocol

Standard OpenAI streaming over `POST {baseUrl}/chat/completions`.
Events separated by `\r?\n\r?\n`. `data:` lines within an event are
joined by `\n` before `JSON.parse`. `data: [DONE]` terminates.
`tool_calls` deltas accumulate by `index`; concatenate
`function.arguments` strings then `JSON.parse` once on stream end.

### Request Body

```js
{
  model: <SUPPORTED_MODELS>,         // 'deepseek-v4-flash' | 'deepseek-v4-pro'
  messages: [
    { role: 'system', content: SYSTEM_PROMPT },
    ...priorHistory,
    { role: 'system', content: '[当前设备状态] LED=…; 电机=…' }, // injected each turn
    trailingUser,
  ],
  tools: TOOLS,                       // OpenAI tools format
  stream: true,
  thinking: { type: 'disabled' },     // hardcoded
}
```

### History Strategy (PRD D8 strategy i)

Assistant messages stored in `history` carry only `{ role, content }`.
`tool_calls` is **not persisted**. Tool-only turns still push an
assistant message with `content: ''` to satisfy OpenAI's
user→assistant→user invariant.

### View Switching

`view-switcher.js` is the **sole writer** of `.app-shell[data-view]`.
Three valid values: `'terminal'` (default), `'ai'`, `'panel'`. CSS
hides the other cards in each view. The `'panel'` view owns LED + motor
cards plus the MQ2 telemetry `.data-card` (owned by `telemetry-panel.js`).

### Validation Matrix (AI specific)

| Condition                            | Behavior                                            |
| ------------------------------------ | --------------------------------------------------- |
| `console.ai.apiKey` empty            | Empty-state config form; bubbles + input hidden     |
| `console.ai.model` invalid value     | `readAiConfig` falls back to `deepseek-v4-flash`    |
| HTTP 401                             | Red system bubble: `API Key 无效，请检查配置`        |
| HTTP 429                             | Red system bubble: `请求过于频繁，请稍后重试`        |
| HTTP 5xx                             | Red system bubble: `DeepSeek 服务异常 (HTTP <s>)`   |
| Network / stream-mid failure         | Red system bubble: `网络连接失败，请检查网络`       |
| `isWsConnected()` false on tool_call | Tool line `⚠ 设备未连接`; `onTool` NOT called       |
| Unknown tool name                    | Tool line `⚠ 未知工具 <name>`                       |
| Tool args JSON parse fail            | Tool line `⚠ 参数解析失败`                          |
| `motor_speed.value` out of `0..3`    | Tool line `⚠ 参数越界`; `onTool` NOT called         |
| Sending while streaming              | Submit short-circuits; input/send disabled          |
| Reload                               | History cleared; `console.ai.*` (3 keys) preserved  |

---

## Reserved-Interface Placeholders

```js
function reservePlaceholder(selector, label) {
  document.querySelectorAll(selector).forEach((node) => {
    node.addEventListener('click', () => {
      console.info(`[placeholder] ${label} not implemented yet`);
    });
  });
}
```

| Element                            | Selector                                | Label    |
| ---------------------------------- | --------------------------------------- | -------- |
| Topbar 文档                        | `.icon-btn[data-action='docs']`         | 文档     |
| Topbar 终端侧栏                    | `.icon-btn[data-action='sidebar']`      | 终端侧栏 |
| Terminal card 复制                 | `.icon-btn[data-action='copy']`         | 复制     |
| Terminal card 全屏                 | `.icon-btn[data-action='expand']`       | 全屏     |

`console.info` is the only side effect. The AI 助手 view toggle is
*not* a placeholder — it switches `view-switcher.js` to `'ai'`.

---

## Design Decisions

### Single URL input vs multi-field

**Decision**: One `ws://host:port/path` input parsed via `parseWsUrl`.
Persist parsed components plus the normalized URL under `console.ws.*`
(backward compatible with pre-rose multi-field forms).

**Why**: matches the prototype, removes 3 fields of visual noise, makes
copy-paste from a deployment doc trivial.

### 3 visual states vs 5 internal

**Decision**: Keep 5 internal `ws-client` states; collapse to 3 in
`config-panel.js#applyView`. Single collapse point so future visual
changes don't ripple into `ws-client.js`.

### Display-layer direction markers in web xterm only (not ws-cli)

**Why split**: ws-cli's contract is "play a dumb device peer";
`echo … | ws-cli > log` requires byte-faithful stdout for log diffing.
The web xterm is human-facing, where the relay's no-echo rule is a
usability problem; local echo + per-direction color is the cheapest fix
and stays inside the display layer. Wire and relay are untouched.

**Implementation seam**: only `main.js` knows about markers. Editing
glyphs/colors is a one-line change. A future "raw view" toggle gates
the writes inside `sendCommand` / `onFrame` — never push marker logic
into `ws-client.js`, `terminal.js`, or `ws-cli.js`.

**Common mistakes**:
- Echo on `client.send` regardless of return value. The boolean is the
  contract — `false` means WS not OPEN and ws-client already logged
  `[ws] not connected`. A second echo there fakes delivery.
- Wrap the marker into `client.send(...)`. Marker bytes on the wire
  break byte-passthrough and confuse downstream device parsers.
- Add the same markers to `ws-cli.js`. Breaks log-redirect testing.

### Motor switch + gear (PRD 05-04)

**Decision**: `data-view='panel'` owns LED + motor + reserved
`.data-card`. Motor splits into `switch:bool` + `gear:1..3`. Wire stays
the existing `motor_speed_<0..3>` — switch OFF emits
`motor_speed_0`, switch ON emits `motor_speed_<gear>`. While switch is
OFF, clicking a gear button only updates in-memory state (passive
memory, no frame).

**Why**: aligns the protocol surface with the user mental model
(ignition + transmission); narrowing 0..5 → 0..3 reflects actual device
capability without backend churn. Passive memory prevents accidental
motor start when pre-selecting a gear.

### AI device-state context

**Decision**: Inject `[当前设备状态] LED=…; 电机=…` as a transient
system message *immediately before* the user turn (not stored in
history). Append a state card to every AI tool round and on manual
"查询状态" trigger.

**Why**: gives the LLM ground truth for no-op suppression ("LED 已是白光,
不要再调 led_on") without polluting persistent history. The state card
gives the operator visual confirmation of post-action state and warns
when the WS is down (snapshot may diverge from device reality).

---

## Tests

- `npm run lint`, `npm run format:check`, `npm test` (lint + smoke).
- Browser / MCP manual: 3 visual states (reload disconnected → click
  连接 with server up → stop server / submit bad URL).
- Reserved-placeholder check: click 文档 / 终端侧栏 / 复制 / 全屏 —
  exactly one `console.info` per click, zero exceptions.
- localStorage check: after a successful connect, all 5 `console.ws.*`
  keys derived from the same parsed URL.
- AI manual: with key + ws-up, send `把灯打开` → LED card flips to 已开启
  and bubble carries a state card; with ws-down, tool line shows
  `⚠ 设备未连接`; invalid key (`sk-invalid`) → red 401 bubble.
- MQ2 manual (via `ws-cli` or device):
  - `temp=23,hum=60,mq2=120,mq2_alarm=0\n` → one sample, status 趋势正常
  - `mq2=200,mq2_alarm=1\n` → status 烟雾异常, card data attr flips,
    curve recolored rose; reverts when next sample drops below alarm.
  - Frames split across messages (`mq2=` in one push, `120,mq2_alarm=0\n`
    in the next) merge into a single sample.
  - Frames with no `mq2`, blank lines, or `mq2=foo` are silently
    ignored; terminal still echoes the raw line via `RX_PREFIX`.

---

## Code Review Checklist

- `index.html` is structure only.
- All imports are relative under `web/js/` or `web/vendor/`.
- xterm stays display-only (`disableStdin: true`, no `onData`).
- `main.js#sendCommand` echoes `${TX_PREFIX}${command}\n` only when
  `client.send` returns `true`.
- `main.js#onFrame` prefixes non-pong incoming text with `${RX_PREFIX}`
  and ensures a trailing `\n`.
- `TX_PREFIX` / `RX_PREFIX` defined exclusively in `main.js`; no marker
  bytes anywhere else.
- `command-panel.js` owns submission and connected-enabled state.
- Single viewport: `100vh`, `overflow: hidden`, no horizontal scroll.
- Single writers preserved: `.app-shell[data-state]` (`config-panel.js`),
  `.app-shell[data-view]` (`view-switcher.js`),
  `console.ws.*` (`config-panel.js#writeConfig`),
  `console.ai.*` (`ai-panel.js#writeAiConfig`).
- `parseWsUrl` covers all four reasons with the exact strings.
- `control-panel.js` and `ai-panel.js` route every cmd through injected
  callbacks (no direct `client.send`, no `.app-shell` mutation).
- `ai-panel.js` validates `model` against `SUPPORTED_MODELS`.
- AI history keeps only `{ role, content }` per assistant turn.
- SSE parser handles `\r?\n\r?\n` separators and merges multiple
  `data:` lines per event.
- For elements toggled via `.hidden = true/false`, the class either
  drops explicit `display:` or pairs with `.x[hidden] { display: none }`.
- All reserved placeholders log `console.info('[placeholder] ...')`
  and don't throw.
- 3-state mapping matches `STATE_VIEW` / `STATE_TO_DATA_STATE` byte-for-byte.
- AI tool→command table matches `control-panel.js` strings byte-for-byte.
