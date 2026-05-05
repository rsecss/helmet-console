# Backend Quality Guidelines

> Executable contracts for the Node.js relay. Read together with
> [`./directory-structure.md`](./directory-structure.md) (where each
> module lives) and [`./error-handling.md`](./error-handling.md).

---

## Forbidden Patterns

- No web framework (Express / Fastify / Koa). Use `node:http` + `sirv` + `ws`.
- No persistence (memory, file, DB). The relay is forward-only.
- No content-based branching in `ws-relay.js` other than (a) reject binary
  frames and (b) intercept the literal `ping` to reply with `pong\n`.
  Adding a JSON envelope, length prefix, allow-list, or regex check
  breaks the "server is business-agnostic" invariant.
- No `console.log`. Use `console.info` / `warn` / `error`.

---

## Scenario: HTTP + WebSocket Relay

### Signatures

```js
// server/src/config.js
export const config = { host, port, wsPath, staticDir, maxClients, heartbeatMs, logLevel };

// server/src/static.js
export function createStaticHandler({ staticDir, getClientCount });

// server/src/ws-relay.js
export function createWsRelay({ wsPath, maxClients, logger = console });
// returns { handleUpgrade(req, socket, head), getClientCount(), close() }
```

### HTTP contract

| Method | Path       | Behavior                                                |
| ------ | ---------- | ------------------------------------------------------- |
| `GET`  | `/`        | Serves `web/index.html` via `sirv`                      |
| `GET`  | `/healthz` | JSON `{ status:"ok", uptime:<int>, clients:<int> }`     |
| `GET`  | `/*`       | Static files under `staticDir`                          |
| other  | any        | JSON 405 (no static lookup)                             |

### WebSocket contract

Each frame is a single UTF-8 **text** message — one command per frame,
terminated by `\n`. No JSON envelope, no schema. Binary frames are not
supported.

| Direction       | Examples                                                  |
| --------------- | --------------------------------------------------------- |
| browser → MCU   | `led_on\n` / `led_color_<white\|red\|green>\n` / `motor_speed_<0..3>\n` |
| browser → peers | `state:led=<off\|white\|red\|green>,motor=<0..3>\n` (relayed text)     |
| MCU → browser   | any UTF-8 text (e.g. `temp=42.3\n`)                       |
| client ↔ server | `ping\n` / `pong\n` (server-intercepted; not relayed)     |

### Validation matrix

| Input / State                  | Server behavior                                            |
| ------------------------------ | ---------------------------------------------------------- |
| Upgrade path ≠ `wsPath`        | Write HTTP `404`, destroy socket                           |
| Connected clients ≥ `maxClients` | Write HTTP `503`, destroy socket                         |
| Binary WebSocket frame         | `ws.close(1003, 'binary frames are not supported')`        |
| Text frame `ping` or `ping\n`  | Reply only to sender with `pong\n`; do not broadcast       |
| Any other text frame           | Broadcast byte-for-byte to every open client except sender |

### Environment

| Variable       | Default   | Note                                      |
| -------------- | --------- | ----------------------------------------- |
| `HOST`         | `0.0.0.0` | Listen host                               |
| `PORT`         | `8080`    | Source of truth (see `operational-scripts.md` for sync rule) |
| `WS_PATH`      | `/ws`     | Exact upgrade pathname                    |
| `STATIC_DIR`   | `web/`    | Resolved from `process.cwd()` when set    |
| `MAX_CLIENTS`  | `32`      | Connection cap                            |
| `HEARTBEAT_MS` | `30000`   | Frontend reference only                   |
| `LOG_LEVEL`    | `info`    | Reserved                                  |

### Tests

`server/scripts/smoke.js` (run via `npm test`) must assert:
- `/healthz` shape, broadcast (text frame in, same bytes out),
  `ping\n` → `pong\n`, binary-frame close with code `1003`.

When the relay's text-frame behavior changes (a new server-intercepted
literal beyond `ping`), extend smoke.

### Wrong vs Correct

```js
// Wrong — re-introducing JSON envelope
ws.on('message', (data) => {
  const frame = JSON.parse(data);
  if (frame.payload.action === 'led_on') { /* … */ }
});

// Correct — flat byte passthrough
ws.on('message', (data, isBinary) => {
  if (isBinary) { ws.close(1003, 'binary frames are not supported'); return; }
  const text = data.toString('utf8');
  if (text.replace(/\r?\n$/, '') === 'ping') { ws.send('pong\n'); return; }
  broadcast(ws, text);
});
```

---

## Scenario: Dev-Side WS CLI Client (`ws-cli.js`)

### Purpose

`server/scripts/ws-cli.js` lets a developer play the **device role** from
a local terminal so the frp tunnel + browser console can be verified
end-to-end. It is the manual counterpart to the loopback `smoke.js`.

### Contract

```
node server/scripts/ws-cli.js [ws-url]   # default ws://127.0.0.1:<config.port><config.wsPath>
node server/scripts/ws-cli.js -h | --help
```

| Channel              | Behavior                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| stdin → ws           | One non-empty line per text frame; append `\n` if missing; empty lines skipped |
| ws (text) → stdout   | `process.stdout.write(text)` byte-for-byte; never trim, prefix, or annotate |
| ws (binary) → stderr | `console.warn('[ws-cli] dropped binary frame (N bytes)')`; frame discarded |
| stdin during `CONNECTING` | Frame buffered into `pending[]`; flushed on `'open'`                  |
| stdin while CLOSING/CLOSED | `console.warn('[ws-cli] not connected; dropped input')`              |
| `ws.error` event     | `console.error` and exit 1                                                |
| SIGINT / stdin EOF   | `ws.close(1000)`; exit 0                                                  |

The `CONNECTING`-state buffer is the load-bearing detail: without it,
`echo "..." | ws-cli.js` silently drops the first frame because the WS
handshake takes a roundtrip. See `Wrong vs Correct` below.

### Wrong vs Correct

```js
// Wrong — drops first frame in scripted use
rl.on('line', (line) => {
  if (ws.readyState !== WebSocket.OPEN) {
    console.warn('[ws-cli] not connected; dropped input');
    return;
  }
  ws.send(line.endsWith('\n') ? line : `${line}\n`);
});

// Correct — buffer during CONNECTING, flush on 'open'
const pending = [];
ws.on('open', () => { while (pending.length) ws.send(pending.shift()); });
rl.on('line', (line) => {
  if (!line) return;
  const frame = line.endsWith('\n') ? line : `${line}\n`;
  if (ws.readyState === WebSocket.CONNECTING) { pending.push(frame); return; }
  if (ws.readyState !== WebSocket.OPEN) { console.warn('[ws-cli] not connected; dropped input'); return; }
  ws.send(frame);
});
```

---

## Code Review Checklist

- `server/src/index.js` is composition only (no routing logic, no frame parsing).
- `/healthz` reports `clients` via `relay.getClientCount()`.
- `ws-relay.js` passes text frames through byte-for-byte; the only
  branches are binary-frame close and `ping` → `pong\n`.
- `ws-relay.js` closes binary frames with code `1003` (no error envelope).
- New env vars are documented here **and** in `docs/deployment.md`.
- `server/scripts/smoke.js` covers the changed contract.
- `server/scripts/ws-cli.js` still buffers stdin during `CONNECTING`.
- Relay port changes touch all three sites — see `operational-scripts.md`.
- No `console.log`.

---

## Telemetry (Deferred)

Future device → browser real-time telemetry reuses the byte-passthrough
wire. **No new server verbs, no envelope, no JSON.** The frame format
will be a flat ASCII string (e.g. `telemetry rpm 1234\n`) decided when
device firmware lands. The frontend seam is `client.onFrame` in
`web/js/main.js`; populate it with a verb-prefix parser routing
recognized telemetry to a chart widget vendored under `web/vendor/`.
