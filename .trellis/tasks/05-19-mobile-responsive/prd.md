# Mobile Responsive Adaptation

## Goal

Make the existing Helmet Console web UI usable on mobile browsers (iOS Safari, Android Chrome) without sacrificing the current 1480px desktop layout. The PC layout was designed in `docs/design/prototype-rose.html` and is currently the only first-class target; on mobile the page is cropped and unusable.

## Background

Current state (from `web/index.html` + `web/css/style.css`):

- `viewport` meta is set (`width=device-width, initial-scale=1`), and `body { min-width: 320px }` is in place.
- One narrow `@media (max-width: 768px)` block exists, but it only adjusts the MQ2 panel sub-section. The shell, topbar, connection bar, terminal, AI card, command bar, and control cards are still PC-only.
- `.app-shell` uses `height: 100vh` + `overflow: hidden`, so mobile browsers' dynamic address bar clips the top/bottom of the UI.
- `body { overflow: hidden }` disables page scroll, so anything that doesn't fit gets silently lost on small screens.
- Three views (`terminal`, `ai`, `panel`) are toggled via `data-view` on `.app-shell`; only one is visible at a time. This means mobile only needs to make each view legible on its own — they do not need to coexist visibly.

## Requirements

### Functional

- Pages must be usable at viewport widths from 320px up to 1480px+.
- No regression on the existing desktop layout (≥769px) — visual surface must still match `prototype-rose.html`.
- All interactive controls must remain reachable and operable by touch.
- Address bar showing/hiding on mobile must not cause layout jumps that clip content.

### Layout — ≤768px breakpoint (extend existing one)

- `.app-shell`: switch `100vh` → `100dvh`; allow vertical scrolling when content exceeds viewport; reduce horizontal padding.
- `body`: remove `overflow: hidden` only at this breakpoint (page scroll must be available).
- `.topbar`: stack into two rows — brand + icon buttons on row 1; view-toggle on row 2 (full-width, equal-segment buttons).
- `.connection-bar`: stack to two rows — `status-pill` + `conn-url` row 1, action button row 2 (full-width).
- `.terminal-card`: take remaining height via `flex` or `min-height: calc(100dvh - <topbar+conn+command>)`; xterm font reduced to 12px; horizontal scroll inside the terminal window only.
- `.ai-card`: input row stays sticky to bottom of card; bubbles area scrolls.
- `.panel-view`: already collapses control cards to 1 column at 768px — keep, and verify MQ2 chart still readable.
- `.command-bar`: textarea grows naturally; send button full-width if textarea wraps.

### Touch & a11y — ≤480px additional breakpoint

- Min touch target 40×40px for all `.icon-btn`, `.led-btn`, `.motor-switch-btn`, `.motor-gear-btn`, `.conn-action`, `.send-btn`.
- View-toggle buttons distribute evenly (each ≥ 44px tall, full row width).
- AI bubbles widened to 92% of the card.

### Non-goals (this iteration)

- Dedicated mobile virtual keyboard for the terminal (function keys, arrow keys). Tracked as a separate follow-up.
- Re-flowing the HTML structure or introducing new components.
- Build tooling, frameworks, or CSS preprocessors (project constraint: native ESM, no build).
- PWA / install banners.

## Acceptance Criteria

- [ ] Open `http://<LAN-IP>:<port>/` in mobile Chrome and iOS Safari (real device or emulation). All three views render without horizontal page-scroll.
- [ ] Address bar appearing/disappearing does not clip the topbar or hide the command bar.
- [ ] Tapping any button (LED on/off, motor on/off, motor gear, view-toggle tabs, icon buttons, conn action, send) hits its intended target — no accidental misclick on adjacent controls.
- [ ] Connecting to a WS URL, sending a command, and viewing terminal output works end-to-end on the phone.
- [ ] AI view: API key form, message bubbles, and input bar all visible and usable at 360–414px widths.
- [ ] Panel view: control cards stack to one column; MQ2 trend chart renders at the reduced height without overflowing.
- [ ] Desktop layout at ≥1024px is visually unchanged compared to `dev` baseline.
- [ ] `prettier --check` (if configured) passes on touched files.

## Technical Notes

- Edits should be confined to `web/css/style.css` and (if absolutely necessary) `web/js/terminal.js` for xterm font-size config. **Do not** restructure `web/index.html`.
- Use `100dvh` (with `100vh` as the existing fallback only where dvh is unsupported — Safari 15.4+ supports dvh; we accept very old Safari rendering as it was before).
- Keep all media queries co-located at the bottom of `style.css` to match the file's existing organization.
- xterm.js `fit` plugin (if present) must be re-fit after orientation change / resize — verify whether existing JS already handles this.
- Honor the frontend quality-guidelines: no CSS-in-JS, no build step, BEM-ish class naming already in use.

## Findings

### Mobile connection action was obscured

- **Symptom**: On mobile browser viewports the panel content could visually cover or crowd the connection action, making the "连接" button hard to reach.
- **Root cause**: The desktop single-row `.connection-bar` used flex layout. The first mobile pass relied on `flex-wrap`, so the URL field and action button did not have an explicit two-row contract.
- **Fix**: At `max-width: 768px`, `.connection-bar` now uses a two-column grid: `status-pill` + `conn-url` on row 1 and `.conn-action` full-width on row 2. At `max-width: 480px`, touch targets are at least 40-44px.

### Rapid disconnect/reconnect race

- **Symptom**: After a successful mobile connection test, the operator tapped "断开连接", power-cycled the 4G module, then tapped "连接" again and saw Web reconnect failures / stale "not connected" behavior.
- **Root cause**: Browser `WebSocket` events are asynchronous. The old socket's delayed `close` event could run after a new socket was assigned, clearing the active `socket` reference in `web/js/ws-client.js`.
- **Fix**: `ws-client.js#connect` now captures `activeSocket` and ignores stale `open` / `message` / `close` / `error` events. A stale `open` is closed with code `1000` and reason `'stale connection'`.
- **Regression coverage**: `test/ws-client.test.js` mocks the browser `WebSocket` and covers stale `close` after immediate reconnect and stale `open` from an older connection attempt.

## Verification Log

- `npm run test:unit` — passed.
- `npm run format:check` — passed.
- `npm test` — passed (`lint + unit + smoke`).
- Manual mobile browser verification by user — passed.
- Chrome DevTools mobile emulation checked 393x852 and 360x800: no horizontal page scroll; connection action remains visible; panel cards start below the connection bar.
