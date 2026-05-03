# Directory Structure

> How backend code is organized.

---

## Overview

The backend is a **single-process Node.js (ESM)** host server with three
responsibilities and nothing more:

1. Serve static files from `web/` over HTTP
2. Expose `GET /healthz`
3. Relay WebSocket frames between clients on `/ws`

It must not grow into an application framework, a data store, or a business
layer. See `docs/architecture.md` §1 and the Forbidden Patterns in
[`./quality-guidelines.md`](./quality-guidelines.md).

---

## Directory Layout

```text
server/
├── scripts/
│   ├── smoke.js          # Executable smoke test (runs from `npm run smoke`)
│   └── ws-cli.js         # Manual e2e client; cli plays the device role for tunnel verification
└── src/
    ├── index.js          # Process entry: composes static + relay, listens
    ├── config.js         # Reads env vars, exports `config` object (defaults)
    ├── static.js         # `createStaticHandler` — sirv + /healthz + 405
    └── ws-relay.js       # `createWsRelay`  — /ws upgrade, validate, broadcast
```

Runtime artifacts (`logs/`, `node_modules/`) live at the repo root and are
gitignored.

---

## Module Organization

The server has **four modules**, each with a single responsibility:

| Module             | Owns                                                 | Does NOT own                                           |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| `index.js`         | Composition: wire static + relay, `listen`, signals  | Routing logic, frame parsing                           |
| `config.js`        | Reading env vars, defaulting, exporting `config`     | I/O, side effects                                      |
| `static.js`        | `sirv` static handler, `/healthz` JSON, 405 fallback | WebSocket, frame validation                            |
| `ws-relay.js`      | `wss.handleUpgrade`, binary-frame reject, `ping`/`pong` intercept, byte-passthrough broadcast | Interpreting text frame contents (the relay is forward-only) |

A new responsibility deserves a new file in `server/src/` only if it does not
fit one of the four above. Most "new features" should fail PRD review — see
the deferred extensions in `docs/architecture.md` §9.

---

## Naming Conventions

- **Files**: kebab-case `.js` (e.g., `ws-relay.js`, not `wsRelay.js` or
  `WsRelay.js`).
- **Exported factories**: `createXxx({...deps})` returning `{ ... }`.
  Examples: `createStaticHandler`, `createWsRelay`.
- **Module-internal helpers**: lowercase verb-first (e.g., `broadcast` in
  `ws-relay.js`).
- **Constants**: `UPPER_SNAKE` (e.g., `PING_FRAME` / `PONG_FRAME` in
  `ws-relay.js`).
- **No default exports** — always named exports for grep-ability.

Imports are explicit:

```js
import http from 'node:http';                   // node: prefix for built-ins
import WebSocket, { WebSocketServer } from 'ws'; // bare specifier for deps
import { config } from './config.js';            // relative + `.js` suffix
```

> The trailing `.js` is **required** for ESM resolution; ESLint will flag a
> missing extension.

---

## Examples to Read First

When extending the backend, mirror the structure of:

- **Adding a config field**: `server/src/config.js` — see `readNumber` and
  `readPath` helpers; default at the bottom; document the new env var in
  [`./quality-guidelines.md`](./quality-guidelines.md) §3 *and*
  `docs/deployment.md`.
- **Adding an HTTP route**: `server/src/static.js` — branch on
  `req.method` + `url.pathname` before the `sirv(req, res, ...)` fallback.
  Return JSON via the `sendJson` helper, never `res.end(string)`.
- **Adding a WS frame rule**: `server/src/ws-relay.js` — the relay is a
  byte-passthrough; the only allowed branches are binary-frame reject
  and the `ping` → `pong\n` intercept. Adding a new content-based branch
  almost always means a wrong design (push the verb negotiation to the
  browser and device instead). If a rule is genuinely wire-level (e.g.,
  bumping `maxPayload`), cover it with a new assertion in
  `server/scripts/smoke.js`.
