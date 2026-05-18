# Frontend Directory Structure

> Where frontend code lives.

```text
web/
├── css/
│   └── style.css         # Single CSS entry — design tokens lifted from prototype-rose
├── js/
│   ├── main.js           # Composition: DOM lookup + callback wiring + reserved placeholders
│   ├── ws-client.js      # WebSocket transport + 5-state machine + heartbeat
│   ├── terminal.js       # xterm display-only wrapper (white floor, rose cursor)
│   ├── config-panel.js   # URL form + parseWsUrl + console.ws.* + .app-shell[data-state]
│   ├── command-panel.js  # Command textarea + send-enabled state
│   ├── control-panel.js  # LED toggle + motor switch/gear (passive memory)
│   ├── telemetry-panel.js # MQ2 telemetry parser + SVG trend chart
│   ├── view-switcher.js  # .app-shell[data-view] + view-toggle aria-pressed
│   └── ai-panel.js       # DeepSeek V4 chat + tool_calls → cmd; sole writer of console.ai.*
├── vendor/
│   └── xterm/            # Vendored xterm + addon-fit; NEVER from CDN
├── favicon.svg
└── index.html            # Structure only — no inline <script> body / <style>
```

For module ownership and signatures see
[`./quality-guidelines.md`](./quality-guidelines.md). Modules **never**
import each other directly — wiring lives in `main.js` via injected
callbacks (`onConnect`, `onSend`, `onLedOn`, `onTool`, …).

---

## Naming

- **Files**: kebab-case `.js` matching the module's role.
- **Factories**: `createXxx({...deps})` returning `{ ... }` (no default exports).
- **Pure helpers**: lowercase verb-first (`parseWsUrl` exported from `config-panel.js`).
- **Constants**: `UPPER_SNAKE` (`STORAGE_KEYS`, `STATE_VIEW`, `RECONNECT_DELAYS`, …).
- **DOM IDs**: looked up **only** in `main.js#requireElement(id)`. Other
  modules never call `document.getElementById`.
- **Imports**: `.js` / `.mjs` extensions are **required** for browser ESM.

---

## Examples to Mirror

- **Adding a control widget**: `control-panel.js` — factory takes DOM
  nodes + callback, returns local-state setters; never touches
  `client.send` or `.app-shell[data-state]`.
- **Adding a localStorage namespace**: `config-panel.js#writeConfig`
  for `console.ws.*`, `ai-panel.js#writeAiConfig` for `console.ai.*` —
  single write path per namespace. See
  [`./state-management.md`](./state-management.md).
- **Adding a reserved DOM slot**: `main.js#reservePlaceholder` for
  plain icons. For toggles that mirror `aria-pressed` across siblings,
  build a small dedicated module that owns the page-level state
  attribute (mirror `view-switcher.js`).
