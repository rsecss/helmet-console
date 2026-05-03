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
- Do not parse, branch on, or rewrite text frame contents in
  `server/src/ws-relay.js` (the only exception is matching the literal
  `'ping'` to reply with `'pong\n'`). The server is a flat byte
  passthrough — adding a JSON envelope, validating fields, or building a
  command registry breaks the "server is business-agnostic" invariant.
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

Each frame is a single UTF-8 **text** message — one command per frame,
terminated by `\n`. There is no JSON envelope, no required fields, no
schema. Binary frames are not supported.

| Direction      | Examples                                            |
| -------------- | --------------------------------------------------- |
| browser → MCU  | `led_on\n` / `led_off\n` / `motor_speed_<0..5>\n`   |
| MCU → browser  | any UTF-8 text (e.g. `temp=42.3\n`)                 |
| client ↔ server | `ping\n` / `pong\n` (server-intercepted; not relayed) |

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

| Input / State                 | Server behavior                                         |
| ----------------------------- | ------------------------------------------------------- |
| Upgrade path is not `wsPath`  | Write HTTP `404`, destroy socket                        |
| Connected clients exceed max  | Write HTTP `503`, destroy socket                        |
| Binary WebSocket frame        | `ws.close(1003, 'binary frames are not supported')`     |
| Text frame `ping` or `ping\n` | Reply only to sender with `'pong\n'`; do not broadcast  |
| Any other text frame          | Broadcast byte-for-byte to every open client except sender |

#### 5. Good / Base / Bad Cases

- Good: two WebSocket clients connect to `/ws`; client A sends the text
  frame `led_on\n`; client B receives the text frame `led_on\n`
  byte-for-byte; client A does not receive its own frame.
- Base: `GET /healthz` before clients connect returns `clients:0`.
- Bad: client sends a binary frame; server closes that socket with code
  `1003` and other clients are unaffected.

#### 6. Tests Required

- `npm run smoke` must assert `/healthz` shape, broadcast (text frame in,
  same bytes out), `ping\n` → `pong\n`, and that a binary frame closes
  the offending socket with code `1003`.
- `npm test` must run lint plus smoke before commit.
- If the relay's text-frame behavior changes (e.g., a new server-intercepted
  literal beyond `ping`), extend `server/scripts/smoke.js` accordingly.

#### 7. Wrong vs Correct

Wrong:

```js
ws.on('message', (data) => {
  const frame = JSON.parse(data); // re-introducing JSON envelope
  if (frame.payload.action === 'led_on') {
    // Server starts interpreting business commands.
  }
});
```

Correct:

```js
ws.on('message', (data, isBinary) => {
  if (isBinary) {
    ws.close(1003, 'binary frames are not supported');
    return;
  }
  const text = data.toString('utf8');
  if (text.replace(/\r?\n$/, '') === 'ping') {
    ws.send('pong\n');
    return;
  }
  broadcast(ws, text); // byte-for-byte passthrough
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
- Does `ws-relay.js` pass text frames through byte-for-byte, with the
  single exception of `ping` → `pong\n`?
- Does `ws-relay.js` close binary frames with code `1003` instead of
  trying to interpret them?
- Are all new environment variables documented here and in `docs/deployment.md`?
- Does `server/scripts/smoke.js` cover the changed contract (broadcast,
  ping/pong, binary close)?
