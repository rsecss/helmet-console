# Type Safety

> How we keep the JavaScript honest without TypeScript.

---

## Overview

This project is **plain JavaScript (ESM, ES2022+)**. There is no TypeScript
compiler, no `tsconfig.json`, and no `.d.ts` files. Type safety is
achieved through three complementary tools:

1. **JSDoc block comments** — for non-trivial module shapes and contracts
   (selectively; not on every function).
2. **Runtime validation at boundaries** — envelope validation lives on the
   server (`server/src/ws-relay.js`); the frontend only `JSON.parse`s
   incoming WS messages and validates user input via `parseWsUrl`.
   `localStorage` reads fall back to defaults on missing/partial values.
3. **ESLint flat config** — `@eslint/js` recommended ruleset, applied
   separately to `server/**/*.js` (Node globals) and `web/js/**/*.js`
   (browser globals). See `eslint.config.js`.

There is no schema library (no zod / yup / io-ts / valibot). For the
current frame shape (4 known fields) and 4 user-input error reasons, hand-
written guards are smaller and clearer than a schema framework.

The single most important shape — the WebSocket frame — is documented in
`docs/architecture.md` §4 (canonical) and
[`./quality-guidelines.md`](./quality-guidelines.md) §3 "Contracts". Do
not duplicate type definitions; reference these.

---

## Validation

### At the WS boundary

The frontend validates incoming frames lazily — `JSON.parse` failure is the
only check, and it logs `[ws] bad frame`:

```js
// web/js/ws-client.js
socket.addEventListener('message', (event) => {
  markActivity();
  try {
    onFrame(JSON.parse(event.data));
  } catch {
    onLog('[ws] bad frame');
  }
});
```

Per-frame field validation is the **server's** responsibility (see
[`../backend/error-handling.md`](../backend/error-handling.md)). The client
trusts that any frame reaching `onFrame` already has `from` / `type` /
`payload`. It still branches defensively on `frame.type` (e.g.,
`'pong'` vs everything else, `'error'` in `terminal.writeFrame`).

### At the form boundary

`parseWsUrl` is the only structured input validation in the frontend. It
returns a discriminated union:

```js
//   { ok: true,  host, port, path, tls, normalized }
// | { ok: false, reason }
```

Callers must check `.ok` before reading other fields. The four `reason`
values are exact strings — they appear in the error matrix and **also** in
`web/js/config-panel.js`, so changing one means changing both.

### At the `localStorage` boundary

`config-panel.js#readInitialUrl` defends against missing / partial values
by falling back to `defaultUrl()`. A malformed cached URL will fail the
next `parseWsUrl` and surface as an inline error — no exception escapes.

---

## Common Patterns

### JSDoc for module headers

Use JSDoc only when it earns its keep. The convention:

```js
/**
 * Connection bar — single URL input + context-sensitive action button.
 * The 5-state ws-client lifecycle is collapsed onto 3 visual states:
 *   disconnected | connecting → 'disconnected' (button: 连接)
 *   connected                 → 'connected'    (button: 断开连接)
 *   reconnecting | error      → 'error'        (button: 重试)
 */
```

— `web/js/config-panel.js:1-7`. The header captures the design rationale,
not parameter types. **Don't** restate what the code already says.

### Discriminated unions via plain objects

Pure helpers that can fail return `{ ok: true, ... } | { ok: false, reason }`.
Examples in the codebase: `parseWsUrl` (frontend), `parseFrame` (backend
relay; uses `{ frame } | { error }`).

### Type guards via `typeof` / `Array.isArray` / `Object.hasOwn`

The backend's `validateFrame` (in `server/src/ws-relay.js`) is the
canonical example of cheap, explicit guards:

```js
if (!frame || typeof frame !== 'object' || Array.isArray(frame))
  return 'Frame must be a JSON object';
if (typeof frame.from !== 'string' || frame.from.length === 0)
  return 'Frame field "from" must be a non-empty string';
if (typeof frame.type !== 'string' || !VALID_TYPES.has(frame.type))
  return 'Frame field "type" is unsupported';
if (!Object.hasOwn(frame, 'payload'))
  return 'Frame field "payload" is required';
```

Mirror this style when adding a new boundary check. Coercion (`Number(x)`,
clamping) is fine **inside** a module's own boundary (e.g., motor speed
clamp in `control-panel.js`); never coerce at the WS boundary — there,
reject and surface the error.

---

## Forbidden Patterns

- **No `any`-style escape hatches.** There is no TypeScript, but the moral
  equivalent is `// eslint-disable-next-line` over a value of unknown
  shape; don't.
- **No `JSON.parse` without try/catch on untrusted input.** All untrusted
  JSON crosses the WS boundary; the existing patterns in `ws-client.js` and
  `ws-relay.js#parseFrame` are the templates to copy.
- **No silent fallbacks on validation failure.** If `parseWsUrl` returns
  `{ ok: false }`, surface the `reason` to the user (`flagInvalid`); never
  treat the input as valid.
- **No type-checking via `instanceof Error`** for control flow. We don't
  define custom Error classes (see
  [`../backend/error-handling.md`](../backend/error-handling.md)); branch on
  the discriminated-union `ok` flag or on the `error`-frame `code` field
  instead.

---

## Common Mistakes

- **Trusting `localStorage` values to be the right type.** They are always
  strings. Compare with `=== 'true'` for booleans (see
  `config-panel.js#readInitialUrl`).
- **Assuming `event.target.value` is a number.** `<input type="range">`
  emits a string. Coerce with `Number(...)` before arithmetic.
- **Using `parseInt` without a radix.** Always pass `10` (see
  `server/src/config.js#readNumber`).
- **Adding a new frame `type` without updating `VALID_TYPES`.** The set in
  `server/src/ws-relay.js` is the gate; if you forget to extend it, the
  server will `BAD_FRAME` your own messages.
