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
- UI model: serial-assistant style. `web/js/terminal.js` is display-only; commands must be sent through `web/js/command-panel.js`.
- Keep frontend native ESM with no build tool. Vendor browser libraries stay under `web/vendor/`.
