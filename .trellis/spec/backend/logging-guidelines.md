# Logging Guidelines

> How the backend logs.

---

## Overview

The backend logs to **stdout / stderr only** via the standard `console`
methods. There is no logging library (no winston / pino / bunyan), and
there is no log file rotation in code — the `logs/` directory at the repo
root is for user-driven `node server/src/index.js > logs/...` redirection,
not framework output.

---

## Log Levels

The relay accepts an optional `logger` (defaulting to `console`) so that
tests / smoke scripts can substitute a silent logger. In source we use
exactly three methods:

| Method            | When                                                       |
| ----------------- | ---------------------------------------------------------- |
| `console.info`    | Lifecycle events: server listening, signal received, smoke ok |
| `console.warn`    | Recoverable per-client problems: WS client error            |
| `console.error`   | Unrecoverable / unexpected — **rare**; reserved for future  |

`console.log` is **forbidden** (Forbidden Patterns in
[`./quality-guidelines.md`](./quality-guidelines.md)). It does not signal
intent and is harder to grep than the level-prefixed forms.

---

## Structured Logging

We do **not** use JSON structured logging. The volume is low (a few lines
per process lifetime) and operators can read it directly. Lines follow a
loose convention:

```text
[<scope>] <message> [<extra>]
```

`<scope>` is a short bracketed tag identifying the source module:

| Scope       | Module / context                                  |
| ----------- | ------------------------------------------------- |
| `[server]`  | `server/src/index.js` — listen / shutdown lifecycle |
| `[ws]`      | `server/src/ws-relay.js` — per-connection events  |
| `[smoke]`   | `server/scripts/smoke.js` — test progress         |

Examples from the codebase:

```js
console.info(`[server] listening on http://${config.host}:${config.port}`);
console.info(`[server] websocket path ${config.wsPath}`);
console.info(`[server] ${signal} received, shutting down`);
logger.warn('[ws] client error', error.message);
console.info('[smoke] ok');
```

When a log line carries dynamic data, prefer template literals over
`%s`-style format strings.

---

## What to Log

**Do log**:

- Server start (`host`, `port`, `wsPath`)
- Process signal received (SIGINT / SIGTERM) before shutdown
- Per-client WebSocket errors (`ws.on('error', ...)`)

**Do NOT log**:

- Every received frame / broadcast — at 32 max clients with chatty
  devices this would dominate stderr. The relay is forward-only; the
  payload is not interesting at the server.
- `BAD_FRAME` events — they are already reported back to the offending
  client via the `error` envelope. Logging them here doubles the noise
  and provides no operator action.
- `/healthz` requests — health probes will spam logs.
- Successful upgrade / disconnect — count them via `/healthz`, not logs.

If you find yourself wanting to log a frame to debug a flow, reach for
`server/scripts/smoke.js` and add a test instead.

---

## What NOT to Log (security)

**Never** log raw frame `payload`. Devices may stream sensor data, command
transcripts, or future authentication tokens through the relay. The server
is business-agnostic by design (see
[`./quality-guidelines.md`](./quality-guidelines.md) §"Forbidden
Patterns") — logging payloads breaks that guarantee.

---

## Common Mistakes

- **Reaching for a logger library.** YAGNI. `console.info / warn / error`
  with `[scope] message` is sufficient and frees us from a runtime dep on
  the hot path. Revisit only if a real operator complaint arrives.
- **`console.log` slipping in during debugging.** ESLint will not flag it,
  but [`./quality-guidelines.md`](./quality-guidelines.md) does. Use
  `console.info` even for one-off prints, then remove before commit.
- **Logging inside `broadcast(...)`.** This runs once per client per frame
  — a guaranteed log explosion. If you need to instrument throughput, add
  a counter exposed via `/healthz`, not a log line.
- **Using `console.error` for client problems.** A misbehaving client is a
  warning, not an error — it does not threaten process health. Reserve
  `error` for issues an operator must act on.
