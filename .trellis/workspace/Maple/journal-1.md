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


## Session 3: Bootstrap project guidelines (Karpathy trim + Codex adversarial review)

**Date**: 2026-05-03
**Task**: Bootstrap project guidelines (Karpathy trim + Codex adversarial review)
**Branch**: `dev`

### Summary

(Add summary)

### Main Changes

### Summary

Filled the 9 stub spec files under `.trellis/spec/{backend,frontend}/` from real `server/src/*.js` and `web/js/*.js` code, then ran two cleanup passes against the result: a Karpathy-rules trim (remove speculation / duplication / unrequested abstraction) and an adversarial Codex MCP review that produced 14 cited defects against the actual code. Accepted 14 / rejected 2 (the rejected pair were intentional Pre-Dev Checklist + Quality Check sections in the two `index.md` files, kept as navigation hooks for `/trellis:before-dev` and `/trellis:check`). Net trim ~11% across the 9 new files plus 2 indexes (1080 → 966 lines).

Three files were declared with explicit out-of-scope status: `backend/database-guidelines.md` (Not Applicable — relay is forward-only) and `frontend/component-guidelines.md` + `hook-guidelines.md` (Deferred — no framework). Each carries the trigger condition that would reactivate it.

Separately, `python3` was replaced with `python` across the entire vendored Trellis tooling (30 files, mechanical 1:1 substitution) — committed in isolation so `trellis update` can be reverted independently if needed.

### Main Changes

| Area | Files | Notes |
|------|-------|-------|
| spec/backend | `directory-structure.md`, `error-handling.md`, `logging-guidelines.md` (Filled); `database-guidelines.md` (N/A); `index.md` (status table) | Real code refs: `server/src/{index,config,static,ws-relay}.js`, `server/scripts/smoke.js` |
| spec/frontend | `directory-structure.md`, `state-management.md`, `type-safety.md` (Filled); `component-guidelines.md` + `hook-guidelines.md` (Deferred); `index.md` (status table) | Real code refs: `web/js/{main,ws-client,terminal,config-panel,command-panel,control-panel}.js` |
| Trim pass | All 9 + 2 indexes | Removed: duplicate of quality-guidelines content, speculative "if PRD ever…" paragraphs, style-preference rules, "log query strings (none today)…", `console.debug` lecture, "API Error Responses" duplicate of quality §3 |
| Adversarial fixes | 7 backend + 7 frontend edits | Highlights: removed false claim that smoke covers bad-frame isolation; removed `clientError`-is-logged contradiction; corrected `localStorage.console.ws.*` notation to `console.ws.*` localStorage keys; fixed broken link text/URL mismatch in `database-guidelines.md`; documented both reserved-handler shapes (plain icon vs segmented toggle); removed "leading-zero parses as octal" (Node 18+ doesn't trigger) |
| Trellis tooling | `.trellis/scripts/**/*.py`, `.trellis/workflow.md`, `.trellis/workspace/index.md` | `python3` → `python` (30 files, +172/-172) |
| Task | `00-bootstrap-guidelines` subtasks → completed; archived to `archive/2026-05/` | |

### Updated Files

Spec (filled / trimmed / fixed):
- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/backend/directory-structure.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/backend/index.md`
- `.trellis/spec/backend/logging-guidelines.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/directory-structure.md`
- `.trellis/spec/frontend/hook-guidelines.md`
- `.trellis/spec/frontend/index.md`
- `.trellis/spec/frontend/state-management.md`
- `.trellis/spec/frontend/type-safety.md`

Task / metadata:
- `.trellis/tasks/00-bootstrap-guidelines/prd.md` (`python3` → `python` in checklist)
- `.trellis/tasks/00-bootstrap-guidelines/task.json` (subtasks → completed)
- `.trellis/workspace/Maple/journal-1.md` (Sessions 3 + 4 added inline before this record)

Trellis tooling rename (separate commit `c17f9e1`):
- `.trellis/scripts/**/*.py` (28 files)
- `.trellis/workflow.md`
- `.trellis/workspace/index.md`

### Verification

- `npx prettier --check` on all 11 touched spec `.md` files → all pass
- `grep "python3" .trellis/spec .trellis/tasks/00-bootstrap-guidelines` → 0 matches
- `grep "localStorage.console.ws" .trellis/spec` → 0 matches (post-fix)
- `grep "indirectly enforces" .trellis/spec` → 0 matches (post-fix)
- Net diff: spec subset 1080 → 966 lines (~11% trimmed)

### Status

[OK] **Completed** — task archived; spec/ ready for AI agent consumption via `/trellis:before-dev` and `/trellis:check`.

### Next Steps

- None — all bootstrap guidelines work shipped.


### Git Commits

| Hash | Message |
|------|---------|
| `7c1f4ce` | (see git log) |
| `c17f9e1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Console tunnel bringup via frp + defaultUrl fix

**Date**: 2026-05-03
**Task**: Console tunnel bringup via frp + defaultUrl fix
**Branch**: `dev`

### Summary

(Add summary)

### Main Changes

| 工作项 | 描述 |
|---|---|
| 部署架构 | 方案 B 混合：浏览器 `wss://websocket.vaple.cc/ws` → CF 边缘 → VPS nginx:443 → frps:13000 → frpc → 本机 :8080；下位机 `ws://45.205.25.184:13000/ws` 直连绕开 CF |
| Web 修复 | `web/js/config-panel.js` 的 `defaultUrl()` 在反代部署下不再回退 `:8080`；显式端口沿用、反代源走 scheme-standard 443/80、仅本地裸 origin 用 :8080 |
| 部署脚本 | `deploy/start.py` 对齐 helmet-console（npm start 替代 pnpm dev；:8080 替代 :3000；移除 stdout/stderr DEVNULL；真实 URL 提示） |
| 防泄漏 | `deploy/frpc.toml` 加入 .gitignore；新建 `deploy/frpc.example.toml` 模板（无真凭据） |
| Spec 同步 | `spec/frontend/quality-guidelines.md` §4 增 3 条 `defaultUrl()` 端口推导契约；§5 增 1 条 "defaultUrl over-default" Bad case |
| 验证 | Chrome DevTools 自动化测试 9/9 AC：healthz、CF AMS 边缘可达、URL 默认值无 :8080、WS 升级成功、端到端 sim-device → frps:13000 → :8080 broadcast → 浏览器 xterm 显示 |

**Updated Files**:

- `web/js/config-panel.js`
- `.trellis/spec/frontend/quality-guidelines.md`
- `deploy/start.py` (new)
- `deploy/frpc.example.toml` (new)
- `.gitignore`

**Decision (ADR-lite)**:

- **Context**：开发期联调；VPS 在海外；m100pg + DTU 固件 wss 支持未确认
- **Decision**：方案 B 混合——浏览器 wss（CF + nginx）、下位机 ws 直连 :13000，共享同一 frps 隧道
- **Consequences**：浏览器侧体面（https + 域名）；下位机侧绕开模组兼容；两路对外暴露面增大；下位机流量明文（开发期可接受）

**Followups deferred**:

- R5 安全加固：轮换 frps token + Dashboard 密码 + 评估 git 历史清理 + frps systemd 守护
- `deploy/frpc.exe` 二进制建议下次小修加 .gitignore


### Git Commits

| Hash | Message |
|------|---------|
| `f232de8` | (see git log) |
| `c94524f` | (see git log) |
| `fb3d25c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
