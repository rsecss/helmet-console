# Error Handling

> How errors are surfaced and handled in the backend.

---

## Overview

The backend is a **forward-only relay**. There is no business logic, no
database, and no application-level error taxonomy. Error handling collapses
to three categories:

1. **WebSocket envelope errors** — bad frames from a client → reply with an
   `error` frame to that client only, do not broadcast.
2. **HTTP errors** — non-`GET`/`HEAD` methods or unknown paths → JSON 4xx
   response.
3. **Per-WS failures** — `ws.on('error', ...)` → log via `console.warn`,
   keep other clients alive. HTTP `clientError` silently writes a 400 and
   ends the socket (malformed HTTP on a public listener is expected).

There are **no custom Error classes**. Protocol issues use the structured
`error`-frame envelope; everything else is a plain `Error`.

---

## Error Types

### `error`-frame envelope (the only WS error shape)

Defined and emitted by `server/src/ws-relay.js#sendError`:

```js
{
  from: 'server',
  type: 'error',
  payload: { code: '<UPPER_SNAKE>', message: '<human-readable>' },
  ts: <number>,
}
```

Allowed `code` values (extend this list when adding a new validation rule):

| Code        | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| `BAD_FRAME` | Binary frame, non-JSON, missing/invalid envelope fields  |

### HTTP error responses

Always JSON, served by `server/src/static.js#sendJson`:

```js
{ status: 'error', message: '<human-readable>' }
```

| Status | When                                            |
| ------ | ----------------------------------------------- |
| `405`  | Method other than `GET` / `HEAD`                |
| `404`  | `sirv` cannot find the requested static file    |

### Upgrade-time HTTP errors

Written directly to the raw socket, then `socket.destroy()`:

| Response               | When                                              |
| ---------------------- | ------------------------------------------------- |
| `404 Not Found`        | Upgrade path is not `config.wsPath`               |
| `503 Service Unavailable` | Connected clients ≥ `config.maxClients`        |

---

## Error Handling Patterns

### Pattern 1: Validate envelope, never `payload`

`server/src/ws-relay.js` is the only module that can reject WS messages.
Validation lives in three pure helpers:

```js
function parseFrame(data) {
  try {
    return { frame: JSON.parse(data.toString('utf8')) };
  } catch {
    return { error: 'Frame must be UTF-8 JSON text' };
  }
}

function validateFrame(frame) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame))
    return 'Frame must be a JSON object';
  if (typeof frame.from !== 'string' || frame.from.length === 0)
    return 'Frame field "from" must be a non-empty string';
  if (typeof frame.type !== 'string' || !VALID_TYPES.has(frame.type))
    return 'Frame field "type" is unsupported';
  if (!Object.hasOwn(frame, 'payload'))
    return 'Frame field "payload" is required';
  return null;
}
```

On any validation failure, call `sendError(ws, 'BAD_FRAME', message)` and
**return**. Never branch on `payload` — that breaks the
"server is business-agnostic" invariant (Forbidden Patterns in
[`./quality-guidelines.md`](./quality-guidelines.md)).

### Pattern 2: Per-client failure does not affect peers

WebSocket-level errors are logged via `logger.warn` and contained:

```js
ws.on('error', (error) => {
  logger.warn('[ws] client error', error.message);
});
```

A bad client must not crash the relay or disturb other clients. (`smoke.js`
currently exercises only the happy broadcast path; bad-frame peer isolation
is not covered yet.)

### Pattern 3: Graceful shutdown, fail-loud startup

`server/src/index.js` traps SIGINT / SIGTERM and closes the relay before
exiting:

```js
function shutdown(signal) {
  console.info(`[server] ${signal} received, shutting down`);
  relay.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

Startup (`server.listen`, config parsing) is **not** wrapped in `try/catch` —
let exceptions surface so the process exits with a non-zero code.
`server.on('clientError', ...)` writes a 400 and ends the socket without
logging (malformed HTTP on a public listener is expected).

---

## Common Mistakes

- **Throwing inside `ws.on('message', ...)`.** A throw escapes into `ws`
  and may close the socket without sending an `error` frame. Use the
  `parseFrame` / `validateFrame` → `sendError` flow instead.
- **Adding new error codes without updating the table above and the smoke
  test.** A code that exists only in source rots; documented codes outlive
  the change.
- **Reading `error.stack` into the response payload.** Never. The relay's
  `error` frame body is `{ code, message }` only; stacks go to
  `console.warn` / `console.error`, never on the wire.
- **Wrapping `server.listen` in `try/catch` to "be safe".** Hides
  port-in-use / EACCES; let it crash so the operator notices.
