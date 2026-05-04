# State Management

> How frontend state is organized.

---

## Overview

There is no state-management library (no Redux / Zustand / Pinia / Vuex /
nanostores). State lives in **three well-defined places**, each with a
single owner:

1. **Module-local closure state** — inside the factory function that owns
   it. Examples: the WS socket and reconnect counters in `ws-client.js`,
   the `internalState` string in `config-panel.js`, the streaming flag and
   message history in `ai-panel.js`.
2. **DOM-attribute state** — `.app-shell[data-state]` (owned by
   `config-panel.js`), `.app-shell[data-view]` (owned by
   `view-switcher.js`), `aria-pressed`, `data-variant`, `data-state` on
   `.led-status`. The DOM is the source of truth for what the user sees.
3. **`localStorage`** — the `console.ws.*` namespace (owned by
   `config-panel.js#writeConfig`) for the connection target, and the
   `console.ai.*` namespace (owned by `ai-panel.js#writeAiConfig`) for
   the DeepSeek API configuration.

For why this is enough (and why a state library would be over-kill), see
the locked design constraints in
[`./quality-guidelines.md`](./quality-guidelines.md) §"Frontend-Specific
Hard Constraints".

---

## State Categories

### 1. Connection state (5 internal → 3 visual)

`ws-client.js` exposes a 5-state lifecycle. `config-panel.js` collapses it
onto a 3-state UI surface. The mapping table is in
[`./quality-guidelines.md`](./quality-guidelines.md) §"Required Patterns".

| Owner            | Storage                                          | Who reads                   |
| ---------------- | ------------------------------------------------ | --------------------------- |
| `ws-client.js`   | Closure (`socket`, `reconnectAttempt`, …)        | Itself only                 |
| `config-panel.js`| Closure (`internalState`) + `.app-shell[data-state]` | CSS (dim outside connected) |

### 2. Connection target (persisted)

`config-panel.js#writeConfig` is the **only writer** of these keys. Anyone
may read them.

| Key                | Type   | Source                                       |
| ------------------ | ------ | -------------------------------------------- |
| `console.ws.host`  | string | `parseWsUrl().host`                          |
| `console.ws.port`  | string | `parseWsUrl().port` (defaults: `80` / `443`) |
| `console.ws.path`  | string | `parseWsUrl().path` (default: `'/'`)         |
| `console.ws.tls`   | string | `'true'` if `wss:`, else `'false'`           |
| `console.ws.url`   | string | full normalized `ws[s]://host[:port]/path`   |

Read order on page load (`config-panel.js#readInitialUrl`):

1. `console.ws.url` (canonical)
2. Recompose from `host` / `port` / `path` / `tls` (backward-compatible
   with pre-rose multi-field forms)
3. `defaultUrl()` derived from `window.location`

### 2b. AI configuration (persisted)

`ai-panel.js#writeAiConfig` is the **only writer** of these keys. Anyone
may read them. The AI panel itself reads via `readAiConfig()`, which
defends against a malformed `model` value by falling back to the default.

| Key                  | Type   | Source                                                              |
| -------------------- | ------ | ------------------------------------------------------------------- |
| `console.ai.apiKey`  | string | DeepSeek API key (raw `sk-...`)                                     |
| `console.ai.baseUrl` | string | API base URL (default `https://api.deepseek.com`)                   |
| `console.ai.model`   | string | `deepseek-v4-flash` \| `deepseek-v4-pro` (validated against allow-list) |

Reload behavior: the three keys persist; the AI conversation history
does **not** persist (per PRD D11) — it is a closure-local array and
clears every page load.

### 2c. View selection (NOT persisted)

`view-switcher.js` is the **only writer** of `.app-shell[data-view]`
(`'terminal' | 'ai' | 'panel'`). The chosen view does NOT persist to
localStorage; every reload starts in `'terminal'` (set explicitly in
`main.js` after construction). The `'panel'` view owns LED + motor cards
plus the reserved `.data-card` telemetry slot.

### 3. Widget state (control-panel, command-panel)

| Concern                   | Owner             | Storage                               |
| ------------------------- | ----------------- | ------------------------------------- |
| LED on/off visual         | `control-panel.js`| `aria-pressed` + `.led-status[data-state]` + status text |
| Motor switch (on/off)     | `control-panel.js`| Closure (`motorOn:bool`) + `aria-pressed` on switch buttons + `.motor-display[data-state]` + status text |
| Motor target gear (1..3)  | `control-panel.js`| Closure (`motorGear:1\|2\|3`) + `aria-pressed` on the matching gear button + gear text node |
| Send button enabled       | `command-panel.js`| `sendButton.disabled` + `input.disabled` |
| Inline URL error          | `config-panel.js` | `inlineError.textContent` + `aria-invalid` |

LED state is driven by local click intent (not device confirmation); the
inbound-frame hookup design is in
[`./quality-guidelines.md`](./quality-guidelines.md) §"Required Patterns"
control-panel contract.

Motor state is two-axis: a switch (on/off, the power gate) and a gear
(1..3, the target speed). The wire still carries the existing flat string
`motor_speed_<0..3>`; switch OFF emits `motor_speed_0`, switch ON emits
`motor_speed_<gear>`. **Passive memory rule**: while the switch is OFF,
clicking a gear button only updates the in-memory `motorGear` and
re-paints the highlight — no WS frame is emitted. Inbound mirror via
`controlPanel.setMotorSpeed(value)` accepts integer 0 (switch OFF, gear
preserved) or 1..3 (switch ON, gear ← value); any other value is logged
via `console.warn` and dropped.

---

## Server State

There is no server-state cache layer (no React Query / SWR equivalent).
The only HTTP call is `GET /healthz`, which the UI does not consume.
Real-time data flows through the WebSocket and is rendered immediately by
`terminal.writeText(text)` — there is nothing to memoize.

---

## Common Mistakes

- **Writing `console.ws.*` `localStorage` keys from outside `writeConfig`.**
  Drifts the URL field from the persisted state on next reload. The single
  write path is enforced by [`./quality-guidelines.md`](./quality-guidelines.md)
  Code Review Checklist.
- **Writing `console.ai.*` `localStorage` keys from outside
  `ai-panel.js#writeAiConfig`.** Same hazard as `console.ws.*`. The AI
  config bar (mask + model dropdown + edit form) is the single UI that
  may persist these keys.
- **Mutating `.app-shell[data-state]` from `control-panel.js` /
  `command-panel.js`.** Breaks the dim-outside-`connected` CSS rule and
  desyncs the action button text. Only `config-panel.js#applyView` may
  write it.
- **Mutating `.app-shell[data-view]` from any module other than
  `view-switcher.js`.** Breaks the terminal/ai card swap CSS rule and
  desyncs the topbar `aria-pressed` toggle.
- **Calling `client.send` from a control widget.** Bypasses the cmd
  contract. Widgets emit through injected callbacks (`onLedOn`,
  `onMotorSpeed`, …), and `main.js` is the only place that calls
  `client.send`.
- **Stashing the WebSocket URL in a module-level `let` instead of
  `localStorage`.** Survives within a tab, lost on reload — the worst of
  both worlds.
- **Caching a derived view of `console.ws.*` without re-deriving it.** The
  five keys are the source of truth. Recompute, don't cache.
- **Sending `motor_speed_<n>` on every gear button click regardless of
  switch state.** Defeats the passive-memory rule: with the switch OFF
  the user is pre-selecting a gear, not starting the motor. The correct
  behavior — gear click while switch=OFF updates `motorGear` and the
  `aria-pressed` highlight only, and the next switch-ON click is what
  emits `motor_speed_<gear>`.
- **Resetting `motorGear` to a default when receiving `motor_speed_0`.**
  Frame `motor_speed_0` means "stop" only; the user's selected gear
  must persist so re-enabling the switch resumes at the same gear. The
  `setMotorSpeed(0)` boundary preserves `motorGear` by design.
