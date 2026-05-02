# Journal - Maple (Part 1)

> AI development session journal
> Started: 2026-04-30

---



## Session 1: Bootstrap websocket console

**Date**: 2026-04-30
**Task**: Bootstrap websocket console
**Branch**: `dev`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Backend | Added Node.js ESM HTTP server, static hosting, `/healthz`, and `/ws` WebSocket relay with JSON frame validation, ping/pong, max-client guard, and broadcast excluding sender. |
| Frontend | Added native ESM serial-assistant UI using local xterm vendor files; terminal is display-only and commands send through `command-panel.js`. |
| Tooling | Added ESLint flat config, `npm start`, `npm test`, `npm run smoke`, and format checks. |
| Verification | `npm test`, `npm run format:check`, browser reload/connect/send check, `/healthz` client count, and `git diff --check` passed before commit. |
| Docs/Specs | Added README, updated AGENTS project snapshot, documented executable backend/frontend contracts in `.trellis/spec`, then ignored `docs/` and removed previously tracked docs from Git index per user request. |
| Task | Archived `04-30-console-bootstrap` after commit. |

**Important follow-up context**:
- `docs/` is now ignored by Git and remains local-only.
- Active task `00-bootstrap-guidelines` remains in progress and was not archived.


### Git Commits

| Hash | Message |
|------|---------|
| `17a959c` | (see git log) |
| `1d04893` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Replicate red-themed UI

**Date**: 2026-05-02
**Task**: Replicate red-themed UI
**Branch**: `dev`

### Summary

(Add summary)

### Main Changes

### Summary

Refactored `web/` from the retired green prototype to a 1:1 replica of
`docs/design/prototype-rose.html`. Added LED + motor control widgets,
collapsed the 5-state ws-client lifecycle onto 3 visual states, and
reserved DOM slots (with `console.info` no-op handlers) for AI 助手 /
文档 / 终端侧栏 / 复制 / 全屏. Spec was filled out from scaffold to v2.

### Main Changes

| Area | Summary |
|------|---------|
| Frontend (`web/index.html`) | New topbar (终端/AI助手 segmented + docs/sidebar icons), connection bar with single URL input + 3-variant pill, terminal card with reserved copy/expand icons, command bar with red `>` prompt, LED + motor control cards. App shell locked to 100vh / overflow:hidden. |
| Frontend (`web/css/style.css`) | Rose design tokens lifted from `prototype-rose.html`; `.app-shell[data-state]` drives 50% opacity dim outside `connected`; rose-filled motor slider with live `--fill` percentage. |
| Frontend (`web/js/terminal.js`) | xterm theme: white background `#ffffff`, rose cursor `#dc2626`, GitHub-Light–calibrated 16-color ANSI palette. Stays display-only (`disableStdin: true`, no `onData` sender). |
| Frontend (`web/js/config-panel.js`) | Replaced multi-field form with single `ws://host:port/path` input parsed via new `parseWsUrl()` helper; `STATE_VIEW` + `STATE_TO_DATA_STATE` collapse 5 internal states onto 3 visual states; `writeConfig()` keeps legacy `console.ws.host/port/path/tls` and adds `console.ws.url`. |
| Frontend (`web/js/main.js`) | Wires the new `control-panel` module; `reservePlaceholder()` registers `console.info` no-op handlers for unimplemented topbar / terminal-card buttons. |
| Frontend (`web/js/control-panel.js`) | New module — LED segmented toggle (`aria-pressed` + `[data-state='on'/'off']` + status text "已开启/已关闭") and motor slider (0–5, live `--fill`). Sends `cmd` payloads via injected callbacks; never touches the WS object directly. |
| Spec (`frontend/quality-guidelines.md`) | Filled from "To fill" scaffold to v2 (495 lines). Added 7-section "Native ESM Serial Assistant UI" scenario (signatures, contracts incl. 5→3 state mapping table + 5-key localStorage table + control payload schema, 13-row validation matrix, Good/Base/Bad cases, tests required, 3 Wrong-vs-Correct pairs); added "Reserved-Interface Placeholder Handlers" scenario; added Design Decisions section (why-single-URL / why-3-states / why-placeholder-DOM). |
| Spec (`frontend/index.md`) | Upgraded scaffold to navigation page with Pre-Development Checklist + Quality Check sections; status grid marks `quality-guidelines.md` as Filled, `component/hook` as Deferred (no framework). |
| Docs (project root) | `README.md`: directory tree adds `web/js/control-panel.js` and the 3 files in `docs/design/`; removed dead `DESIGN.md` reference; documented `prototype-rose.html` as the current prototype. `AGENTS.md`: snapshot now mentions control-panel, the 3-state UI surface, and the rose prototype as the spec. (Local-only `docs/architecture.md` was also synced — `docs/` is git-ignored.) |

### Updated Files

- `web/index.html`
- `web/css/style.css`
- `web/js/main.js`
- `web/js/terminal.js`
- `web/js/config-panel.js`
- `web/js/control-panel.js` (new)
- `AGENTS.md`
- `README.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/tasks/05-02-ui-replica-red/` (archived to `archive/2026-05/`)

### Testing

- [OK] `npm run lint` — 0 errors
- [OK] `npm run format:check` — all files Prettier-clean
- [OK] `npm test` (lint + smoke) — `[smoke] ok` (HTTP `/healthz` + WS broadcast)
- [OK] Manual 3-state verification — screenshots in
  `archive/2026-05/05-02-ui-replica-red/screenshots/` cover
  disconnected, connected, after-disconnect (error state visually
  validated against prototype but no screenshot captured)
- [OK] Reserved-placeholder check — every reserved button logs exactly
  one `console.info('[placeholder] ...')` with zero exceptions

### Important follow-up context

- `parseWsUrl()` is exported as a pure helper; it's reusable from
  future modules (e.g., a connection-history dropdown).
- `controlPanel.setLedState(isOn)` and `setMotorSpeed(n)` are wired
  but only called locally on click. Once `ws-client` learns to
  dispatch device `status` frames to per-card subscribers, `main.js`
  can hook them up for true device-confirmed mirroring — it's a
  drop-in change.
- `docs/architecture.md` is git-ignored (`docs/` in `.gitignore`).
  Architecture edits this session are local-only; if remote teammates
  need them, that policy needs revisiting.
- `00-bootstrap-guidelines` task remains in_progress: backend/* and
  several frontend/* spec files (directory-structure, state-management,
  type-safety) are still scaffolds.
- `DESIGN.md` does not exist; PRD explicitly deferred recreating it.
  `prototype-rose.html` is the design source of truth for now.

### Status

[OK] **Completed** — task archived to `.trellis/tasks/archive/2026-05/05-02-ui-replica-red/`.

### Next Steps

- Continue `00-bootstrap-guidelines`: fill remaining frontend spec
  scaffolds + start backend spec.
- Optional: capture an error-state screenshot
  (`screenshots/04-error.png`) by stopping the server mid-session.
- Optional: rebuild a tokens-only `DESIGN.md` from
  `prototype-rose.html`'s `:root` block if external designers need
  a non-HTML reference.


### Git Commits

| Hash | Message |
|------|---------|
| `4dfb74c` | (see git log) |
| `8d084f7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
