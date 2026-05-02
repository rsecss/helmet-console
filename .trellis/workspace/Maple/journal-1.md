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


---


## Session 3: Bootstrap guidelines — fill + Karpathy trim

**Date**: 2026-05-02
**Task**: `00-bootstrap-guidelines` (still `in_progress`; user will commit + finish)
**Branch**: `dev`

### Summary

Filled the 9 remaining `.trellis/spec/{backend,frontend}/*.md` stubs by
reading real code (`server/src/*.js`, `web/js/*.js`,
`docs/architecture.md`, `docs/contributing.md`, `eslint.config.js`,
`.prettierrc.json`). Three files are explicitly **Not Applicable /
Deferred** with the trigger condition that would un-defer them
(database — relay is forward-only; component / hook — no framework).
Updated both `index.md` status tables to **Filled / Deferred / N/A**.

Then ran a Karpathy-rules trim pass on the same set:

| Rule applied   | Cuts (examples) |
| -------------- | --------------- |
| #2 Simplicity  | Removed "Project-level files" tables that duplicated quality-guidelines §"Project-Wide Conventions"; removed type-safety "Type Organization" pointer-only section; removed "When to Promote State" speculative table; removed `console.debug` lecture; removed "Pattern 4: Fail loud / fail quiet" abstraction without code; removed "API Error Responses" duplicate of quality-guidelines §3 |
| #3 Surgical    | Did **not** touch `quality-guidelines.md` v2 (already stable); did **not** delete pre-existing dead text in unrelated files; kept every Common Mistake that maps to a real code location |
| YAGNI removals | "If the PRD ever adds a REST surface…", "log env vars with secrets (none today)…", "log query strings (none today)…", "reading localStorage in inner loop", "`@param` for trivially-named parameters" |

Net: 9 new files + 2 indexes = 1080 lines → 981 lines (~9% trimmed; the
two existing `quality-guidelines.md` files are untouched).

Also replaced `python3` → `python` in
`.trellis/tasks/00-bootstrap-guidelines/prd.md` (2 occurrences in the
Completion Checklist — relevant for the Windows shell where `python` is
the launcher).

### Main Changes

| Area          | Summary |
| ------------- | ------- |
| spec/backend  | Filled `directory-structure`, `error-handling`, `logging-guidelines`; marked `database-guidelines` as N/A; updated `index` status table |
| spec/frontend | Filled `directory-structure`, `state-management`, `type-safety`; marked `component-guidelines` and `hook-guidelines` as Deferred; updated `index` status table |
| Trim pass     | Removed duplicates of quality-guidelines content + speculative future-PRD paragraphs + style-preference rules |
| Tooling       | `npx prettier --check` over the touched files passes; no source-code changes |
| Task          | `task.json` subtasks marked `completed`; status stays `in_progress` until user commits |

### Scope boundary (deliberately not changed)

`python3` references inside Trellis-managed assets were left untouched:

- `.trellis/scripts/*.py` (5 files) — vendored tooling; `trellis update` may overwrite
- `.trellis/workspace/index.md` — generated by `init_developer.py`; same risk

If project-wide replacement is wanted, that's a separate decision — either
accept the upgrade-overwrite risk, or fork the scripts.

### Git Commits

(none yet — user to commit then run `record-session`)

### Testing

- [OK] `npx prettier --check` on all 11 touched `.md` files
- [OK] `grep python3 .trellis/spec .trellis/tasks/00-bootstrap-guidelines` → no matches
- [PEND] Human visual review of the 9 filled files
- [PEND] `npm test` + `npm run format:check` (no code changed, but PRD recommends running before commit)

### Status

[ACTIVE] Awaiting user review + commit + `task.py finish` + `record-session`

### Next Steps

- User reviews the 9 filled spec files
- User decides on Trellis-managed `python3` references (leave / replace)
- User commits, then runs `task.py finish` and `archive 00-bootstrap-guidelines`


---


## Session 4: Adversarial Codex review + 14 fixes

**Date**: 2026-05-02
**Task**: `00-bootstrap-guidelines` (still `in_progress`)
**Branch**: `dev`

### Summary

Ran an adversarial review on the 9 newly-filled spec files via the Codex
MCP (`mcp__codex__codex`, read-only sandbox). Codex returned 14 concrete
defects with `file:line` citations against `server/src/*.js`,
`web/js/*.js`, and the existing v2 `quality-guidelines.md`. Verified each
defect by re-reading the cited code, then applied 14 surgical edits.
Rejected 2 defects (Codex called the `index.md` Pre-Dev Checklist + Quality
Check sections "duplicate of quality" — kept; they are the navigation
hooks the trellis hooks inject).

### Defects fixed

| # | File | Defect | Fix |
| - | ---- | ------ | --- |
| 1 | `backend/error-handling.md` | "smoke test indirectly enforces bad-client isolation" — `smoke.js#verifyBroadcast` only tests happy path | Replaced with explicit "not covered yet" note |
| 2 | `backend/error-handling.md` | L17 lists `clientError` as logged but L137 says "without logging" — true contradiction | Removed `clientError` from "logged" category |
| 3 | `backend/error-handling.md` | "plain Error for fatal configuration issues" — `config.js` only fallbacks, never throws | Replaced with "everything else is a plain Error" |
| 4 | `frontend/type-safety.md` | "every value crossing WS boundary is validated" contradicts §Validation (frontend only `JSON.parse`s) | Rewrote: server validates envelope; client only parses |
| 5 | `backend/database-guidelines.md` | Link text says `quality-guidelines.md` but URL points to `state-management.md` | Aligned both to `state-management.md` |
| 6 | `frontend/directory-structure.md` | "use `reservePlaceholder`" — but `main.js:101-112` uses custom handler for segmented `aria-pressed` toggle | Documented both branches (plain icons vs segmented toggles) |
| 7 | `frontend/state-management.md` | `localStorage.console.ws.*` is wrong — keys are strings under `localStorage`, not properties on it | Rewrote as `console.ws.*` `localStorage` keys |
| 8 | `frontend/state-management.md` | LED "local intent + future status frame" duplicates quality-guidelines L190 | Replaced with pointer to control-panel contract |
| 9 | `frontend/state-management.md` | Link `§"3-state UI surface"` — that is bold text in quality, not a heading | Re-pointed to `§"Required Patterns"` |
| 10 | `backend/database-guidelines.md` | Block-quoted "no persistence" rule duplicates quality | Collapsed to single sentence + link |
| 11 | `backend/database-guidelines.md` | "In that case, fill this file with: chosen library, schema conventions…" — speculation | Removed |
| 12 | `backend/logging-guidelines.md` | "~80 chars / future stats endpoint" — subjective rule | Removed |
| 13 | `frontend/type-safety.md` | "leading-zero parses as octal in legacy engines" — Node 18+ doesn't trigger this | Removed (kept "always pass radix 10") |
| 14a | `frontend/component-guidelines.md` | Speculative future framework conventions / migration / a11y list | Compressed to "re-fill from chosen framework's conventions" |
| 14b | `frontend/hook-guidelines.md` | Same shape (future hook conventions list) | Same compression |

### Defects rejected

- `backend/index.md:32-39` and `frontend/index.md:33-42` — Codex flagged
  "duplicates quality checklist". Kept: these are the trellis-template
  Pre-Development Checklist + Quality Check sections that
  `/trellis:before-dev` and `/trellis:check` inject; they are intentional
  navigation hooks, not documentation duplication.

### Tooling

- [OK] `npx prettier --check` on all 11 touched `.md` files
- [OK] `grep "localStorage.console.ws" .trellis/spec/` → empty
- [OK] `grep "indirectly enforces" .trellis/spec/` → empty
- Net trim from this round: 981 → 966 lines (-15)
- Net trim across both passes (Karpathy + Codex review): 1080 → 966 (~11%)

### Status

[ACTIVE] Awaiting user review + commit + `task.py finish` + `record-session`
