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

- Runtime: single Node.js package, ESM, Node 18+.
- Start command: `npm start` → `node server/src/index.js`.
- Quality commands: `npm test` (lint + smoke), `npm run format:check`.
- HTTP routes: `GET /`, `GET /healthz`, static files from `web/`.
- WebSocket: `/ws`, JSON text frames with `from`, `type`, `payload`, optional `ts`.
- UI model: serial-assistant style. `web/js/terminal.js` is display-only; commands are sent through `web/js/command-panel.js` (free-form text) or `web/js/control-panel.js` (LED segmented toggle + motor slider).
- UI surface: 3 visual states (`disconnected` / `connected` / `error`) driven by `.app-shell[data-state]`; `ws-client.js` keeps the internal 5-state lifecycle and `config-panel.js` collapses it.
- Reference UI: `docs/design/prototype-rose.html` is the spec for `web/`. The earlier `prototype.html` (green) is retired.
- Keep frontend native ESM with no build tool. Vendor browser libraries stay under `web/vendor/`.
- Deploy orchestration: `deploy/start.py` boots `npm start` + `frpc` for the local-first dev tunnel. Real config is `deploy/frpc.toml` (gitignored); `deploy/frpc.example.toml` is the template. See `deploy/deploy.md` for the current test environment values (BYO required) and `.trellis/spec/backend/operational-scripts.md` for coding rules.
- Relay port `8080` is the source of truth in `server/src/config.js#PORT`; mirrors live in `deploy/start.py#RELAY_PORT` and `deploy/frpc.toml#localPort` — change all three together.
