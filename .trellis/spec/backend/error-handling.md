# Backend Error Handling

> The relay has no business logic. Error handling is three patterns.

---

## Categories

| Category                | Surface                                                     |
| ----------------------- | ----------------------------------------------------------- |
| Binary WebSocket frames | `ws.close(1003, 'binary frames are not supported')` on the offending socket only |
| HTTP 4xx                | JSON `{ status:'error', message }` via `static.js#sendJson` (`405` for non-`GET`/`HEAD`, `404` for unknown static path) |
| Upgrade failures        | Raw `404 Not Found` (path mismatch) or `503 Service Unavailable` (max clients), then `socket.destroy()` |
| Per-client `ws` errors  | `logger.warn('[ws] client error', error.message)`; other clients unaffected |
| HTTP `clientError`      | `socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')`; not logged |

There are **no custom Error classes** and no on-the-wire `error` payload
— close codes carry the only protocol-level signal.

---

## Patterns

### Pass through, never parse

The only branches in `ws-relay.js#message` are reject-binary and
`ping` → `pong\n`. Adding any other content-based branch breaks the
"server is business-agnostic" invariant.

### Per-client failure isolation

```js
ws.on('error', (error) => {
  logger.warn('[ws] client error', error.message);
});
```

A bad client must not crash the relay or disturb peers.

### Graceful shutdown, fail-loud startup

```js
function shutdown(signal) {
  console.info(`[server] ${signal} received, shutting down`);
  relay.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

`server.listen` is **not** wrapped in `try/catch` — port-in-use / EACCES
must surface as a non-zero exit code so the operator notices.

---

## Common Mistakes

- Re-introducing a JSON `error` envelope. Close codes are sufficient.
- Throwing inside `ws.on('message', ...)` — escapes into `ws` and may
  close the socket without a clean reason. Use `ws.close(code, reason)`.
- Adding a content-based reject (regex on the verb). Breaks
  business-agnostic relay; verb negotiation lives in browser + device.
- Wrapping `server.listen` in `try/catch` — hides startup failures.
