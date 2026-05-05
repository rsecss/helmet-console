# Frontend State Management

> No state library. State lives in three well-defined places, each with
> a single owner.

---

## Three Storage Tiers

1. **Module-local closure state** — inside the factory function that
   owns it (e.g. `socket` + reconnect counters in `ws-client.js`,
   `internalState` in `config-panel.js`, history + streaming flag in
   `ai-panel.js`).
2. **DOM-attribute state** — the source of truth for what the user sees
   (`.app-shell[data-state]`, `.app-shell[data-view]`, `aria-pressed`,
   `data-variant`, `.led-status[data-state]`).
3. **`localStorage`** — `console.ws.*` (owned by `config-panel.js`) and
   `console.ai.*` (owned by `ai-panel.js`).

Module signatures, ownership, and the `console.ws.*` / `console.ai.*`
key tables live in [`./quality-guidelines.md`](./quality-guidelines.md).

---

## State Categories

### Connection (5 internal → 3 visual)

`ws-client.js` exposes a 5-state lifecycle. `config-panel.js#applyView`
collapses it onto 3 `.app-shell[data-state]` values. The mapping table
is in `quality-guidelines.md`.

### Connection target (persisted)

Read order on page load (`config-panel.js#readInitialUrl`):
1. `console.ws.url` (canonical)
2. Recompose from `host` / `port` / `path` / `tls` (backward-compatible
   with pre-rose multi-field forms)
3. `defaultUrl()` derived from `window.location`

### AI configuration (persisted)

Three `console.ai.*` keys (apiKey / baseUrl / model) persist; the
conversation history does **not** — it is a closure-local array that
clears every page load (PRD D11).

### View selection (NOT persisted)

Every reload starts in `'terminal'`. `view-switcher.js` is the sole
writer of `.app-shell[data-view]`.

### Widget state

| Concern                   | Owner             | Storage                                         |
| ------------------------- | ----------------- | ----------------------------------------------- |
| LED visual                | `control-panel.js`| `aria-pressed` + `.led-status[data-state]` + status text |
| Motor switch (on/off)     | `control-panel.js`| Closure `motorOn:bool` + `aria-pressed` + `.motor-display[data-state]` + status text |
| Motor target gear (1..3)  | `control-panel.js`| Closure `motorGear:1|2|3` + `aria-pressed` on the matching gear button + gear text node |
| Send enabled              | `command-panel.js`| `sendButton.disabled` + `input.disabled`        |
| Inline URL error          | `config-panel.js` | `inlineError.textContent` + `aria-invalid`      |

LED state is driven by **local click intent** (no device confirmation
yet). Motor state is two-axis: switch (power gate) + gear (target).

---

## Motor Passive-Memory Rule

The wire still carries `motor_speed_<0..3>`:
- Switch OFF → emit `motor_speed_0`
- Switch ON  → emit `motor_speed_<gear>`

While the switch is OFF, clicking a gear button **only updates the
in-memory `motorGear` and re-paints the highlight** — no WS frame is
emitted. The next switch-ON click is what sends `motor_speed_<gear>`.

Inbound mirror via `controlPanel.setMotorSpeed(value)`:
- `0` → switch OFF, gear preserved (per PRD Q5.3)
- `1..3` → switch ON, gear ← value
- else → `console.warn` and drop

---

## Server State

There is no server-state cache (no React Query / SWR equivalent). The
only HTTP call is `GET /healthz`, which the UI does not consume.
Real-time data flows through the WebSocket and is rendered immediately
by `terminal.writeText(text)`.

---

## Common Mistakes

- Writing `console.ws.*` / `console.ai.*` from outside their owners
  (drifts the URL field / AI config from persisted state on reload).
- Mutating `.app-shell[data-state]` from `control-panel.js` /
  `command-panel.js` (breaks the dim-outside-`connected` rule).
- Mutating `.app-shell[data-view]` from any module other than
  `view-switcher.js` (breaks the card swap and topbar `aria-pressed`).
- Calling `client.send` from a control widget (bypasses the cmd
  contract; widgets emit through injected callbacks).
- Stashing the WS URL in a module-level `let` (lost on reload — worst
  of both worlds).
- Caching a derived view of `console.ws.*` without re-deriving (the
  five keys are the source of truth).
- Sending `motor_speed_<n>` on every gear click regardless of switch
  state (defeats passive memory — the user is pre-selecting, not
  starting the motor).
- Resetting `motorGear` to a default when receiving `motor_speed_0`
  (frame `motor_speed_0` means "stop" only; the user's selected gear
  must persist so re-enabling the switch resumes at the same gear).
