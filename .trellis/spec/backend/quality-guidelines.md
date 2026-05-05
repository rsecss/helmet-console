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
- `server/scripts/ws-cli.js` — manual end-to-end WS client; developer plays the device role for tunnel verification

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
| browser → MCU  | `led_on\n` / `led_off\n` / `led_color_<white|red|green>\n` / `motor_speed_<0..3>\n` |
| browser → peers | `state:led=<off|white|red|green>,motor=<0..3>\n` (ordinary relayed text; not server-interpreted) |
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

### Scenario: Dev-Side WS CLI Client

#### 1. Scope / Trigger

`server/scripts/ws-cli.js` is a developer-ergonomics tool: a small Node
WebSocket client that lets a developer play the **device role** from a
local terminal, paired with the browser console at the other end. It is
the hands-on counterpart to `smoke.js` (which only exercises the
loopback path) and the only way to byte-for-byte verify the frp tunnel
end-to-end.

Trigger this section when modifying `ws-cli.js`, when adding a new
"role" to the protocol, or when changing the relay's text-frame
contract — the cli must continue to behave as a dumb device peer.

#### 2. Signatures

```
node server/scripts/ws-cli.js [ws-url]
node server/scripts/ws-cli.js -h | --help
```

The default URL is computed from `server/src/config.js`:

```js
const DEFAULT_URL = `ws://127.0.0.1:${config.port}${config.wsPath}`;
```

Hard-coding the port or path here would break the
"Three-Place Relay Port Constant" rule in
[`./operational-scripts.md`](./operational-scripts.md).

#### 3. Contracts

| Channel              | Behavior                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| stdin → ws           | One non-empty line per text frame; append `\n` if missing; empty lines skipped |
| ws (text) → stdout   | `process.stdout.write(text)` byte-for-byte; never trim, prefix, or annotate |
| ws (binary) → stderr | `console.warn('[ws-cli] dropped binary frame (N bytes)')`; frame discarded |
| Status messages      | `console.info` / `warn` / `error` with `[ws-cli]` scope; never `console.log` |
| Heartbeat            | None (cli plays the device role; only browsers send `ping\n`)             |
| Reconnect            | None (operator restarts on drop)                                          |
| SIGINT / stdin EOF   | Graceful close with code `1000`; exit 0 on normal close, 1 if `error` fired |

#### 4. Validation & Error Matrix

| State / Input                          | Result                                                  |
| -------------------------------------- | ------------------------------------------------------- |
| stdin line arrives during `CONNECTING` | Frame buffered into `pending[]`; flushed on `'open'`    |
| stdin line arrives while CLOSING / CLOSED | `console.warn('[ws-cli] not connected; dropped input')` |
| Inbound binary frame                   | `console.warn` and discard                              |
| `ws.error` event                       | `console.error` and set exit code 1; close handler exits |
| Normal close (`1000`)                  | `console.info('[ws-cli] closed (code=1000)')`; exit 0   |
| `-h` / `--help`                        | Print usage; exit 0                                     |

#### 5. Good / Base / Bad Cases

- **Good** (`echo "device_data" | node server/scripts/ws-cli.js`): cli
  starts, readline emits the line during `CONNECTING`, the line is
  buffered into `pending`, `'open'` fires and flushes `pending`, stdin
  hits EOF, cli initiates `ws.close(1000)`. The relay broadcasts the
  frame to every other client byte-for-byte.
- **Base** (interactive TTY): operator types `temp=42.3` + Enter, the
  line is sent immediately; inbound frames stream to stdout as they
  arrive; `Ctrl+C` triggers shutdown.
- **Bad** (regression): if the `CONNECTING`-state buffer is removed,
  scripted use silently drops the very first frame — observable as
  `[ws-cli] not connected; dropped input` printed *before*
  `[ws-cli] connected`.

#### 6. Tests Required

- `npm run lint` and `npm run smoke` continue to pass after changes —
  the cli has no automated harness because scripted stdin/ws timing is
  fragile in CI.
- Manual end-to-end run before any cross-layer protocol change:
  1. `python deploy/start.py` — relay + frpc come up; `/healthz` over
     the public host returns `200`.
  2. Browser opens `https://<public-host>/`, clicks Connect, badge goes
     green.
  3. Browser → CLI: a persistent cli (`tail -f /dev/null | node
     server/scripts/ws-cli.js > logs/ws-cli.log`) records the marker
     typed into the browser command bar byte-for-byte.
  4. CLI → Browser: a one-shot cli (`echo "marker" | node
     server/scripts/ws-cli.js`) sends a marker; the browser terminal
     renders it byte-for-byte (verify with
     `document.querySelectorAll('.xterm-rows > div')`).

#### 7. Wrong vs Correct

**Wrong** — drop input that arrives before `'open'`:

```js
rl.on('line', (line) => {
  if (ws.readyState !== WebSocket.OPEN) {
    console.warn('[ws-cli] not connected; dropped input');
    return;
  }
  ws.send(line.endsWith('\n') ? line : `${line}\n`);
});
```

This silently breaks `echo "..." | ws-cli.js`: stdin is readable as
soon as the parent shell flushes, but the WebSocket handshake takes
roundtrip time. The very first frame is dropped on every scripted run.

**Correct** — buffer during `CONNECTING`, flush on `'open'`:

```js
const pending = [];

ws.on('open', () => {
  console.info('[ws-cli] connected');
  while (pending.length > 0) {
    ws.send(pending.shift());
  }
});

rl.on('line', (line) => {
  if (!line) return;
  const frame = line.endsWith('\n') ? line : `${line}\n`;
  if (ws.readyState === WebSocket.CONNECTING) {
    pending.push(frame);
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
    console.warn('[ws-cli] not connected; dropped input');
    return;
  }
  ws.send(frame);
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
- Does `server/scripts/ws-cli.js` still buffer stdin lines that arrive
  during `CONNECTING` and flush them on `'open'`?

---

## Telemetry (Deferred)

Future device → browser real-time telemetry (e.g. live RPM, sensor
readings) reuses the existing byte-pass-through wire — **no new server
verbs, no envelope, no length prefix, no JSON**. The relay code in
`server/src/ws-relay.js` does not change when telemetry is added.

The frame format is TBD; it will be a flat ASCII string (e.g.
`telemetry rpm 1234\n`) decided when device firmware lands. The frontend
seam lives next to `reservePlaceholder('.data-card', ...)` in
`web/js/main.js`; populate it with a parser that branches on the verb
prefix inside `client.onFrame` and routes recognized telemetry frames to
a chart widget. Vendor any chart library under `web/vendor/`.

Until then, the `.data-card` is a click-only `console.info` placeholder
and the wire stays as documented above.
