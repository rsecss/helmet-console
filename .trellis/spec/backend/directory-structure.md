# Backend Directory Structure

> Where backend code lives.

```text
server/
├── scripts/
│   ├── smoke.js          # `npm run smoke` — HTTP / WS smoke test
│   └── ws-cli.js         # Manual e2e client; plays the device role
└── src/
    ├── index.js          # Process entry: composes static + relay, listens
    ├── config.js         # Reads env vars, exports `config`
    ├── static.js         # `createStaticHandler` — sirv + /healthz + 405
    └── ws-relay.js       # `createWsRelay` — /ws upgrade, validate, broadcast
```

Runtime artifacts (`logs/`, `node_modules/`) are at the repo root and gitignored.

---

## Module Responsibilities

| Module        | Owns                                            | Does NOT own                                    |
| ------------- | ----------------------------------------------- | ----------------------------------------------- |
| `index.js`    | Composition, `listen`, signal handling          | Routing logic, frame parsing                    |
| `config.js`   | Env reading, defaults                           | I/O, side effects                               |
| `static.js`   | sirv, `/healthz`, 405 fallback                  | WebSocket, frame validation                     |
| `ws-relay.js` | `wss.handleUpgrade`, binary reject, ping intercept, byte-passthrough broadcast | Interpreting text frame contents |

A new responsibility deserves a new file in `server/src/` only if it
does not fit one of the four above.

---

## Naming

- **Files**: kebab-case `.js`.
- **Factories**: `createXxx({...deps})` returning `{ ... }` (no default exports).
- **Constants**: `UPPER_SNAKE`.
- **Imports**: `node:` prefix for built-ins; `.js` suffix required for ESM.

---

## Examples to Mirror

- **Add a config field**: `server/src/config.js` — see `readNumber` /
  `readPath`. Document new env vars in `quality-guidelines.md` *and*
  `docs/deployment.md`.
- **Add an HTTP route**: `server/src/static.js` — branch before the
  `sirv` fallback; return JSON via `sendJson`.
- **Add a WS frame rule**: usually wrong — push verb negotiation to
  browser/device instead. If genuinely wire-level (e.g. `maxPayload`),
  cover it with a new smoke assertion.
