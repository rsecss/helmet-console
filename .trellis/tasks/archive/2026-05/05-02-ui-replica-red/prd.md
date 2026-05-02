# Replicate Red-Themed UI (Production Refactor)

## Goal

Refactor the production frontend under `web/` to **1:1 replicate** the rose-
themed prototype at `prototype-rose.html`. Components, layout, color tokens,
and interaction states all come from the prototype; **DESIGN.md is not the
reference for this iteration** (it describes the retired green variant).

For features that are **not yet implemented in production** (AI助手 view,
docs icon, terminal sidebar icon, copy/expand buttons, LED state mirroring),
add the DOM + a no-op handler so the interface is reserved for future wiring.

## Why Refactor (Not Sandbox)

The earlier sandbox phase (delivered `prototype-rose.html`) validated the
visual direction. The user has now chosen the rose system; the prototype is
the spec. We refactor `web/` directly rather than maintaining two parallel
designs.

## Requirements (locked decisions)

1. **Terminal**: keep `xterm.js`. Re-theme to white background with
   GitHub-Light–style ANSI palette and a rose cursor.
2. **Connection states**: keep the prototype's **3-state surface**
   (disconnected / connected / error). Internal `ws-client` lifecycle
   unchanged (5 states); `main.js` collapses them onto the 3 visual states:
   - `disconnected` | `connecting` → pill `disconnected`, button "连接"
     (disabled while connecting)
   - `connected` → pill `connected`, button "断开连接"
   - `reconnecting` | `error` → pill `error`, button "重试", inline error text
3. **Sensor card**: removed. Only LED + Motor remain (matches prototype).
4. **Connection input**: single URL field (`ws://host:port/path`). The
   `parseWsUrl()` helper from the prototype is the single source of truth;
   on successful parse, write back to the existing `console.ws.{host,port,
   path,tls}` localStorage keys (backward compatible with the previous form).
5. **Reserved interfaces** (DOM present, handler is `console.info` no-op):
   - Topbar `终端 / AI助手` segmented toggle
   - Topbar `文档` icon button
   - Topbar `终端侧栏` icon button
   - Terminal card header `复制` / `全屏` icon buttons
   - LED status display (`已开启 / 已关闭`) — driven by local click intent
     for now; flip to device-confirmed mirror once `ws-client` dispatches
     status frames to per-card subscribers (deferred).

## Scope

In scope:
- Rewrite `web/index.html` to match prototype DOM.
- Rewrite `web/css/style.css` with the prototype's design tokens.
- Update `web/js/main.js` to wire the new DOM and collapse 5→3 UI states.
- Replace `web/js/config-panel.js` with a single-URL form using `parseWsUrl`.
- Re-theme `web/js/terminal.js` to white + rose cursor + GitHub-Light ANSI.
- Add `web/js/control-panel.js` for LED segmented toggle + Motor slider
  (slider live `--fill` update).
- Keep `web/js/ws-client.js` and `web/js/command-panel.js` largely unchanged
  (only adjustments needed to match new DOM bindings).

Out of scope:
- Backend changes (`server/`) — none required.
- Updating `DESIGN.md` (token system there is the retired v1).
- Implementing AI助手 view, docs viewer, terminal sidebar, copy/expand
  feature, or LED bidirectional state mirroring (placeholder only).
- Real WebSocket integration tests (`npm run smoke` continues to pass).

## Acceptance Criteria

- [ ] `web/index.html` structure matches `prototype-rose.html` body.
- [ ] App shell locked to `100vh` with `overflow: hidden` (no page scroll).
- [ ] Topbar: brand + segmented `终端 / AI助手` + 文档/终端 icon buttons.
      No avatar.
- [ ] Connection bar: status pill (3 variants) + monospaced URL input +
      single context-sensitive action button (`连接` / `断开连接` / `重试`).
- [ ] Terminal card: `SYSTEM OUTPUT` caption, copy/expand icons in header,
      xterm.js rendered with white background and rose cursor.
- [ ] Command bar: red `>` prompt + Chinese placeholder + rose `发送` button;
      disabled outside `connected` state.
- [ ] LED card: segmented `开启 / 关闭` with active state in
      rose-soft fill; status row shows `已开启 / 已关闭` with colored dot.
- [ ] Motor card: large numeric value + rose-filled slider 0–5 with live
      `--fill` percentage and tick labels `0` / `5`.
- [ ] State machine driven by `data-state` attribute on `.app-shell`.
      Controls + command bar dim to 50% opacity outside `connected`.
- [ ] Reserved-interface elements call a labelled `console.info` placeholder
      and do not throw.
- [ ] `npm run lint` and `npm run format:check` pass.
- [ ] Existing localStorage keys (`console.ws.host/port/path/tls`) still
      written on successful connect.

## Technical Notes

- Color tokens live as CSS custom properties on `:root` in `style.css`
  (lifted directly from the prototype's `:root` block).
- The prototype's inline JS is split into module files under `web/js/`,
  matching the existing module structure.
- xterm theme overrides: `background:#ffffff`, `foreground:#18181b`,
  `cursor:#dc2626`, plus an ANSI 16-color override for white-floor
  readability (deferred — start with default ANSI, add palette later if
  contrast issues appear).
- `parseWsUrl()` returns `{ host, port, path, tls, normalized, ok, reason }`
  — same signature as the prototype.

## Decision Log

- **Why drop DESIGN.md as a reference?** User confirmed the rose variant
  is the new direction; DESIGN.md describes the retired green calibration.
  Updating DESIGN.md is a follow-up task, not a blocker.
- **Why 3 visual states (not 5)?** User chose to match the prototype.
  Internal lifecycle stays at 5 states; the UI collapses them.
- **Why keep xterm.js?** Real device output may include ANSI escape
  sequences; the prototype's plain-HTML log rows can't render those.
  Re-theming xterm to a white floor preserves the rose look.
- **Why placeholder DOM for unimplemented features?** A reserved
  interface is cheaper to wire later than retrofitting markup. The handler
  prints `console.info` so QA can verify the slot exists.
