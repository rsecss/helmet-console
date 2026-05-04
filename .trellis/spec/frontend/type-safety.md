# Type Safety

> How we keep the JavaScript honest without TypeScript.

---

## Overview

This project is **plain JavaScript (ESM, ES2022+)**. There is no TypeScript
compiler, no `tsconfig.json`, and no `.d.ts` files. Type safety is
achieved through three complementary tools:

1. **JSDoc block comments** — for non-trivial module shapes and contracts
   (selectively; not on every function).
2. **Runtime validation at boundaries** — there is no envelope to
   validate; the WebSocket carries flat UTF-8 text frames, and the
   frontend forwards them straight to the terminal (after intercepting
   `pong\n` for heartbeat). User input is validated via `parseWsUrl`.
   `localStorage` reads fall back to defaults on missing/partial values.
3. **ESLint flat config** — `@eslint/js` recommended ruleset, applied
   separately to `server/**/*.js` (Node globals) and `web/js/**/*.js`
   (browser globals). See `eslint.config.js`.

There is no schema library (no zod / yup / io-ts / valibot). For 4
user-input error reasons, hand-written guards are smaller and clearer
than a schema framework.

The wire format — flat UTF-8 lines ending in `\n`, no envelope — is
documented in `docs/architecture.md` §4 (canonical) and
`docs/interface.md`. The frontend signature for sending is
`client.send(text)`; for receiving, `onFrame(text)`. Do not duplicate
those definitions; reference them.

---

## Validation

### At the WS boundary

There is no boundary parsing. `event.data` is a string (the relay never
sends binary), and the client forwards it verbatim to `onFrame(text)`.
Binary frames are dropped with a log line:

```js
// web/js/ws-client.js
socket.addEventListener('message', (event) => {
  markActivity();
  if (typeof event.data !== 'string') {
    onLog('[ws] dropped binary frame');
    return;
  }
  onFrame(event.data);
});
```

`main.js` is the only place that branches on the text — currently a
single check that strips a trailing `\r?\n` and compares against
`'pong'` to drop heartbeat replies; everything else hits
`terminal.writeText(text)`. If a future feature needs structured device
messages, prefer a verb prefix (`status_*`, `data_*`) over reintroducing
a JSON envelope.

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
Examples in the codebase: `parseWsUrl` (frontend); `translateTool` in
`ai-panel.js` returns `{ command } | { error }`.

### Type guards via `typeof` / `Array.isArray` / `Object.hasOwn`

Use cheap, explicit guards at every boundary that crosses out of a
known-shape type. Example from `ai-panel.js#translateTool`:

```js
if (name === 'motor_speed') {
  const v = Number(args && args.value);
  if (!Number.isInteger(v) || v < 0 || v > 3) {
    return { error: '参数越界' };
  }
  return { command: `motor_speed_${v}` };
}
```

Mirror this style when adding a new boundary check. Coercion (`Number(x)`,
clamping) is fine **inside** a module's own boundary (e.g., motor speed
clamp in `control-panel.js`); reject and surface the error when the
input came from an untrusted source (LLM tool args, user form input).

---

## Forbidden Patterns

- **No `any`-style escape hatches.** There is no TypeScript, but the moral
  equivalent is `// eslint-disable-next-line` over a value of unknown
  shape; don't.
- **No `JSON.parse` without try/catch on untrusted input.** The WS wire
  is plain text now, but the AI panel still receives JSON from DeepSeek
  (`tool_calls.function.arguments`); see `ai-panel.js` for the
  `try { JSON.parse(...) } catch { … '⚠ 参数解析失败' }` template.
- **No silent fallbacks on validation failure.** If `parseWsUrl` returns
  `{ ok: false }`, surface the `reason` to the user (`flagInvalid`); never
  treat the input as valid.
- **No type-checking via `instanceof Error`** for control flow. We don't
  define custom Error classes (see
  [`../backend/error-handling.md`](../backend/error-handling.md)); branch
  on the discriminated-union `ok` flag instead.

---

## Common Mistakes

- **Trusting `localStorage` values to be the right type.** They are always
  strings. Compare with `=== 'true'` for booleans (see
  `config-panel.js#readInitialUrl`).
- **Assuming `event.target.value` is a number.** `<input type="range">`
  emits a string. Coerce with `Number(...)` before arithmetic.
- **Using `parseInt` without a radix.** Always pass `10` (see
  `server/src/config.js#readNumber`).
- **Re-introducing a JSON envelope on the wire to "carry metadata".**
  The protocol is flat strings now; if structured metadata is genuinely
  required, treat it as a protocol redesign and update both ends plus
  the docs. Do not bolt JSON onto a single command.
