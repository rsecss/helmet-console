# Frontend Type Safety

> Plain JavaScript (ESM, ES2022+). No TypeScript, no `.d.ts`, no schema
> library. Type safety is achieved through three complementary tools.

---

## Tools

1. **JSDoc block comments** — for non-trivial module shapes; selective.
2. **Runtime guards at boundaries** — `parseWsUrl` for user input,
   `typeof event.data !== 'string'` for the WS boundary, `JSON.parse`
   in `try/catch` for AI tool args. `localStorage` reads fall back to
   defaults on missing values.
3. **ESLint flat config** — `@eslint/js` recommended ruleset, applied
   separately to `server/**/*.js` (Node globals) and `web/js/**/*.js`
   (browser globals). See `eslint.config.js`.

The wire format is documented in `docs/architecture.md` §4 and
`docs/interface.md`.

---

## Validation Boundaries

### WS messages

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

`main.js#onFrame` is the only place that branches on the text — strip
trailing `\r?\n` and compare against `'pong'` to drop heartbeat replies;
everything else hits `terminal.writeText`. If a future feature needs
structured device messages, prefer a verb prefix (`status_*`, `data_*`)
over reintroducing a JSON envelope.

### Form input

`parseWsUrl` returns a discriminated union:

```js
//   { ok: true,  host, port, path, tls, normalized }
// | { ok: false, reason }
```

Callers must check `.ok` first. The four `reason` strings appear in the
error matrix **and** in `config-panel.js` — change one, change both.

### localStorage

`config-panel.js#readInitialUrl` falls back to `defaultUrl()` on missing
or partial values. A malformed cached URL fails the next `parseWsUrl`
and surfaces as inline error — no exception escapes.

---

## Patterns

### Discriminated unions for fallible helpers

```js
// ai-panel.js#translateTool
if (name === 'motor_speed') {
  const v = Number(args && args.value);
  if (!Number.isInteger(v) || v < 0 || v > 3) {
    return { error: '参数越界' };
  }
  return { command: `motor_speed_${v}` };
}
```

`{ command } | { error }` mirrors `{ ok, ... } | { ok: false, reason }`.

### Cheap explicit guards

Use `typeof` / `Array.isArray` / `Object.hasOwn` / `Number.isInteger`
at every boundary that crosses out of a known-shape type. Coercion
(`Number(x)`, clamping) is fine *inside* a module's own boundary; reject
and surface the error when the input came from an untrusted source
(LLM tool args, user form input).

---

## Forbidden

- **No `any`-style escape hatches.** No TypeScript, but the moral
  equivalent is `// eslint-disable-next-line` over a value of unknown
  shape — don't.
- **No `JSON.parse` without `try/catch` on untrusted input.** The WS
  wire is plain text now, but AI tool args still arrive as JSON
  strings; see `ai-panel.js` for the
  `try { JSON.parse(...) } catch { … '⚠ 参数解析失败' }` template.
- **No silent fallbacks on validation failure.** If `parseWsUrl`
  returns `{ ok: false }`, surface the reason via `flagInvalid`; never
  treat the input as valid.
- **No `instanceof Error` for control flow.** Branch on the
  discriminated-union `ok` flag instead.

---

## Common Mistakes

- Trusting `localStorage` values to be the right type — they are always
  strings. Compare with `=== 'true'` for booleans.
- Assuming `event.target.value` is a number — `<input type="range">`
  emits a string. Coerce with `Number(...)` before arithmetic.
- Using `parseInt` without a radix. Always pass `10`.
- Re-introducing a JSON envelope on the wire to "carry metadata". The
  protocol is flat strings; structured metadata is a protocol redesign,
  not a single-command bolt-on.
