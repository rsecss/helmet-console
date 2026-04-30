# Quality Guidelines

> Code quality standards for backend development.

---

## Project-Wide Conventions (Apply Here First)

Before reading the sections below, follow these project-level conventions
(applicable to backend and frontend alike):

- `docs/contributing.md` — branch policy, Conventional Commits, formatter toolchain, git hooks
- `docs/architecture.md` — system architecture, module boundaries, WS message protocol
- `.prettierrc.json` — formatter rules (single quote, semi, 100 cols, LF)
- `.editorconfig` — UTF-8 / LF / 2-space / final newline
- `.gitattributes` — enforces LF in working tree on all platforms

The sections below capture **backend-specific** rules (Node.js + `ws` relay).
They will be filled as concrete code patterns emerge in P2 (`server/` MVP).

---

## Overview

Backend code is a lightweight Node.js ESM host server. It serves static files and
bridges WebSocket clients; it must not become an application framework or a data
storage layer.

Current backend entry points:

- `server/src/index.js` — process entrypoint and HTTP/WS composition
- `server/src/config.js` — environment parsing and defaults
- `server/src/static.js` — static files plus `/healthz`
- `server/src/ws-relay.js` — `/ws` upgrade handling, frame validation, broadcast
- `server/scripts/smoke.js` — executable health and relay smoke checks

---

## Forbidden Patterns

- Do not add Express, Fastify, Koa, or routing frameworks for the MVP server.
  Use `node:http`, `sirv`, and `ws`.
- Do not persist WebSocket frames in memory, files, or a database. The relay is
  forward-only.
- Do not inspect or branch on `payload` business content in `server/src/ws-relay.js`.
  The server may validate envelope fields only.
- Do not use `console.log`; use `console.info`, `console.warn`, or
  `console.error` for process-visible messages.

---

## Required Patterns

### Scenario: HTTP Static Server and WebSocket Relay

#### 1. Scope / Trigger

Any change to `server/src/index.js`, `server/src/static.js`,
`server/src/ws-relay.js`, `server/src/config.js`, or `docs/interface.md` changes
the host-side interface contract and must keep this section current.

#### 2. Signatures

```js
// server/src/config.js
export const config = {
  host,
  port,
  wsPath,
  staticDir,
  maxClients,
  heartbeatMs,
  logLevel,
};

// server/src/static.js
export function createStaticHandler({ staticDir, getClientCount });

// server/src/ws-relay.js
export function createWsRelay({ wsPath, maxClients, logger = console });
// returns { handleUpgrade(req, socket, head), getClientCount(), close() }
```

#### 3. Contracts

HTTP:

| Method | Path       | Contract                                                |
| ------ | ---------- | ------------------------------------------------------- |
| `GET`  | `/`        | Serves `web/index.html` through `sirv`                  |
| `GET`  | `/healthz` | JSON `{ status:"ok", uptime:<number>, clients:<int> }` |
| `GET`  | `/*`       | Serves static files under `config.staticDir`            |
| other  | any        | JSON `405`, no static lookup                            |

WebSocket:

| Field     | Required | Contract                                            |
| --------- | -------- | --------------------------------------------------- |
| `from`    | yes      | Non-empty string; client self-identifies            |
| `type`    | yes      | `data`, `cmd`, `status`, `error`, `ping`, or `pong` |
| `payload` | yes      | Any JSON value, including `null`                    |
| `ts`      | no       | Unix milliseconds; server fills when missing        |

Environment:

| Variable       | Default   | Rule                                      |
| -------------- | --------- | ----------------------------------------- |
| `HOST`         | `0.0.0.0` | Listen host                               |
| `PORT`         | `8080`    | Positive integer, fallback on invalid     |
| `WS_PATH`      | `/ws`     | Exact upgrade pathname                    |
| `STATIC_DIR`   | `web/`    | Resolved from `process.cwd()` when set    |
| `MAX_CLIENTS`  | `32`      | Positive integer, fallback on invalid     |
| `HEARTBEAT_MS` | `30000`   | Positive integer, frontend reference only |
| `LOG_LEVEL`    | `info`    | Reserved                                  |

#### 4. Validation & Error Matrix

| Input / State                | Server behavior                                           |
| ---------------------------- | --------------------------------------------------------- |
| Upgrade path is not `wsPath` | Write HTTP `404`, destroy socket                          |
| Connected clients exceed max | Write HTTP `503`, destroy socket                          |
| Binary WebSocket frame       | Send `{ from:"server", type:"error", code:"BAD_FRAME" }` |
| Invalid JSON                 | Send `BAD_FRAME`, do not broadcast                        |
| Missing `from/type/payload`  | Send `BAD_FRAME`, do not broadcast                        |
| `type:"ping"`                | Reply only to sender with `type:"pong"`                   |
| Valid non-ping frame         | Broadcast to every open client except sender              |

#### 5. Good / Base / Bad Cases

- Good: two WebSocket clients connect to `/ws`; client A sends
  `{ from:"web", type:"data", payload:"hello" }`; client B receives the frame
  with a numeric `ts`; client A does not receive its own frame.
- Base: `GET /healthz` before clients connect returns `clients:0`.
- Bad: client sends `not-json`; server replies to only that client with
  `payload.code:"BAD_FRAME"` and keeps the connection usable.

#### 6. Tests Required

- `npm run smoke` must assert `/healthz` shape and WS broadcast behavior.
- `npm test` must run lint plus smoke before commit.
- If frame validation changes, extend `server/scripts/smoke.js` with at least one
  bad-frame assertion.

#### 7. Wrong vs Correct

Wrong:

```js
ws.on('message', (data) => {
  const frame = JSON.parse(data);
  if (frame.payload.action === 'led_on') {
    // Server starts interpreting business commands.
  }
});
```

Correct:

```js
ws.on('message', (data) => {
  const { frame } = parseFrame(data);
  broadcast(ws, normalizeFrame(frame));
});
```

---

## Testing Requirements

- Run `npm test` for backend changes. This currently executes `npm run lint`
  and `npm run smoke`.
- Run `npm run format:check` before commit.
- Manual browser checks are required when backend changes alter visible
  connection behavior or `/healthz` client counts.

---

## Code Review Checklist

- Is `server/src/index.js` still composition-only?
- Does `/healthz` count clients via `relay.getClientCount()`?
- Does `ws-relay.js` validate envelope fields without interpreting `payload`?
- Are all new environment variables documented here and in `docs/deployment.md`?
- Does `server/scripts/smoke.js` cover the changed contract?
