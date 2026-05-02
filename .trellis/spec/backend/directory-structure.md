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
│   └── smoke.js          # Executable smoke test (runs from `npm run smoke`)
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
| `ws-relay.js`      | `wss.handleUpgrade`, parse + validate frame, broadcast | Reading `payload` semantics (the relay is forward-only) |

A new responsibility deserves a new file in `server/src/` only if it does not
fit one of the four above. Most "new features" should fail PRD review — see
the deferred extensions in `docs/architecture.md` §9.

---

## Naming Conventions

- **Files**: kebab-case `.js` (e.g., `ws-relay.js`, not `wsRelay.js` or
  `WsRelay.js`).
- **Exported factories**: `createXxx({...deps})` returning `{ ... }`.
  Examples: `createStaticHandler`, `createWsRelay`.
- **Module-internal helpers**: lowercase verb-first (`parseFrame`,
  `validateFrame`, `normalizeFrame`, `sendFrame`, `sendError`).
- **Constants**: `UPPER_SNAKE` (e.g., `VALID_TYPES` in `ws-relay.js`).
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
- **Adding a WS frame rule**: `server/src/ws-relay.js` — extend `VALID_TYPES`
  or `validateFrame`; never branch on `payload` content. Cover the change
  with a new assertion in `server/scripts/smoke.js`.
