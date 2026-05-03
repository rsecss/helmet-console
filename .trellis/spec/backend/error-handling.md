# Error Handling

> How errors are surfaced and handled in the backend.

---

## Overview

The backend is a **forward-only relay**. There is no business logic, no
database, and no application-level error taxonomy. Error handling
collapses to three categories:

1. **Binary frames** — `ws.close(1003, ...)` on the offending socket
   only. There is no JSON `error`-frame envelope; the WebSocket close
   code is the entire signal.
2. **HTTP errors** — non-`GET`/`HEAD` methods or unknown paths → JSON
   4xx response.
3. **Per-WS failures** — `ws.on('error', ...)` → log via `console.warn`,
   keep other clients alive. HTTP `clientError` silently writes a 400 and
   ends the socket (malformed HTTP on a public listener is expected).

There are **no custom Error classes** and no on-the-wire `error`
payload. Protocol violations close the offending socket; everything else
is a plain `Error`.

---

## Error Types

### WebSocket protocol violations

| Trigger                | Server behavior                                                       |
| ---------------------- | --------------------------------------------------------------------- |
| Binary WebSocket frame | `ws.close(1003, 'binary frames are not supported')` on that socket only |

There is no on-the-wire error envelope. Other text frames are passed
through byte-for-byte without interpretation, so the relay has no
"invalid format" to report — by design.

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

| Response                  | When                                              |
| ------------------------- | ------------------------------------------------- |
| `404 Not Found`           | Upgrade path is not `config.wsPath`               |
| `503 Service Unavailable` | Connected clients ≥ `config.maxClients`           |

---

## Error Handling Patterns

### Pattern 1: Pass through, never parse

`server/src/ws-relay.js` is a flat byte-passthrough. The only branches
in the message handler are (a) reject binary frames and (b) intercept
the literal `'ping'` to reply with `'pong\n'`.

```js
ws.on('message', (data, isBinary) => {
  if (isBinary) {
    ws.close(1003, 'binary frames are not supported');
    return;
  }
  const text = data.toString('utf8');
  if (text.replace(/\r?\n$/, '') === 'ping') {
    if (ws.readyState === WebSocket.OPEN) ws.send('pong\n');
    return;
  }
  broadcast(ws, text);
});
```

Adding any other content-based branch (e.g., a server-side allow-list of
verbs, a length cap, a regex check) breaks the
"server is business-agnostic" invariant in
[`./quality-guidelines.md`](./quality-guidelines.md). Cap protections
that are wire-level (e.g., `maxPayload`) belong in the `WebSocketServer`
constructor, not in the message handler.

### Pattern 2: Per-client failure does not affect peers

WebSocket-level errors are logged via `logger.warn` and contained:

```js
ws.on('error', (error) => {
  logger.warn('[ws] client error', error.message);
});
```

A bad client must not crash the relay or disturb other clients. The
smoke test exercises broadcast, ping/pong, and binary-close paths;
client-level error isolation is an `ws.on('error', ...)` invariant
covered by the underlying `ws` library.

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

- **Re-introducing a JSON envelope to "carry an error code".** The
  protocol is flat strings; close codes carry the only protocol-level
  signal. If a future feature needs structured errors, treat that as a
  protocol redesign, not an extension.
- **Throwing inside `ws.on('message', ...)`.** A throw escapes into `ws`
  and may close the socket without a clean reason. Either branch and
  return cleanly, or call `ws.close(code, reason)` explicitly.
- **Adding a content-based reject (e.g., regex on the verb).** That
  breaks the "server is business-agnostic" invariant. Devices and
  browsers negotiate the command vocabulary; the relay is not a gate.
- **Wrapping `server.listen` in `try/catch` to "be safe".** Hides
  port-in-use / EACCES; let it crash so the operator notices.
