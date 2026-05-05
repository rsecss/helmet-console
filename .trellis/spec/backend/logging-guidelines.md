# Backend Logging Guidelines

> Console-only. No logger library. No structured JSON.

---

## Levels

| Method            | When                                                       |
| ----------------- | ---------------------------------------------------------- |
| `console.info`    | Lifecycle: server listening, signal received, smoke ok     |
| `console.warn`    | Recoverable per-client problems (e.g. WS client error)     |
| `console.error`   | Unrecoverable / unexpected — **rare**, reserved for future |

`console.log` is **forbidden**: it does not signal intent and is harder
to grep than the level-prefixed forms. ESLint will not flag it; the
review checklist will.

---

## Format

```text
[<scope>] <message> [<extra>]
```

| Scope       | Source                                            |
| ----------- | ------------------------------------------------- |
| `[server]`  | `server/src/index.js` (listen/shutdown lifecycle) |
| `[ws]`      | `server/src/ws-relay.js` (per-connection events)  |
| `[smoke]`   | `server/scripts/smoke.js` (test progress)         |
| `[ws-cli]`  | `server/scripts/ws-cli.js` (manual e2e client)    |

Use template literals for dynamic values, not `%s` format strings.

---

## What to Log

**Do**:
- Server start (`host`, `port`, `wsPath`)
- Process signal received before shutdown
- Per-client WebSocket errors

**Don't**:
- Every received frame / broadcast — at 32 max clients with chatty
  devices this dominates stderr.
- Binary-frame closes — already signalled via close code `1003`.
- `/healthz` requests — health probes will spam logs.
- Successful upgrade / disconnect — use `/healthz` for the count.

If you find yourself wanting to log a frame to debug a flow, add a
smoke assertion instead.

---

## Security

**Never** log raw text frame contents. Devices may stream sensor data,
command transcripts, or future authentication tokens through the relay.
Logging the wire breaks the business-agnostic guarantee.

---

## Common Mistakes

- Reaching for a logger library (winston / pino / bunyan). YAGNI.
- `console.log` slipping in during debugging. Use `console.info` and
  remove before commit.
- Logging inside `broadcast(...)` — runs once per client per frame.
  Counter via `/healthz` if you need throughput visibility.
- `console.error` for client problems — a misbehaving client is a
  warning, not an error.
