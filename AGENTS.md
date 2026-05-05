<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

Use the `/trellis:start` command when starting a new session to:
- Initialize your developer identity
- Understand current project context
- Read relevant guidelines

Use `@/.trellis/` to learn:
- Development workflow (`workflow.md`)
- Project structure guidelines (`spec/`)
- Developer workspace (`workspace/`)

If you're using Codex, project-scoped helpers may also live in:
- `.agents/skills/` for reusable Trellis skills
- `.codex/agents/` for optional custom subagents

Keep this managed block so 'trellis update' can refresh the instructions.

<!-- TRELLIS:END -->

# Project Snapshot

- Runtime: single Node.js package, ESM, Node 18+. Start: `npm start`.
- Quality: `npm test` (lint + smoke), `npm run format:check`.
- HTTP: `GET /`, `GET /healthz`, static under `web/`.
- WebSocket: `/ws`, flat UTF-8 text frames terminated by `\n`. No JSON envelope. See [`docs/architecture.md`](docs/architecture.md) §4 and [`docs/interface.md`](docs/interface.md).
- UI: serial-assistant model. Three views switched by `view-switcher.js` writing `.app-shell[data-view]`: `terminal` (xterm + command bar), `ai` (DeepSeek V4 chat with `tool_calls` → `cmd`), `panel` (LED + motor + reserved telemetry slot).
- Single writers: `.app-shell[data-state]` ← `config-panel.js`; `.app-shell[data-view]` ← `view-switcher.js`; `console.ws.*` ← `config-panel.js#writeConfig`; `console.ai.*` ← `ai-panel.js#writeAiConfig`.
- Frontend stays native ESM with no build tool. Vendor browser libs under `web/vendor/`.
- Deploy: `deploy/start.py` boots `npm start` + `frpc` for the local-first dev tunnel. Real config `deploy/frpc.toml` is gitignored; `deploy/frpc.example.toml` is the template. See [`deploy/deploy.md`](deploy/deploy.md).
- Relay port `8080` lives in three sites — `server/src/config.js`, `deploy/start.py`, `deploy/frpc.toml` — change all together. Rule in `.trellis/spec/backend/operational-scripts.md`.
