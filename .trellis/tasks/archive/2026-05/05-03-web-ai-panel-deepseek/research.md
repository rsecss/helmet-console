# Research Findings

> Self-research output for `05-03-web-ai-panel-deepseek` (prepared for implement subagent).

## 1. Relevant Code-Specs (must follow)

| Spec | Why |
|---|---|
| `.trellis/spec/frontend/quality-guidelines.md` | Hard module boundaries, localStorage single-owner, reserved-placeholder pattern, code review checklist |
| `.trellis/spec/frontend/directory-structure.md` | Naming conventions (kebab-case, `createXxx({...})` factories, no default exports, `.js` ext required) |
| `.trellis/spec/frontend/state-management.md` | 3 state locations (closure / DOM / localStorage), single-writer rule, `console.ws.*` mirror pattern |
| `.trellis/spec/frontend/type-safety.md` | JSDoc selectively, discriminated union `{ok:true,...} | {ok:false,reason}`, JSON.parse + try/catch, localStorage values are strings |
| `.trellis/spec/guides/code-reuse-thinking-guide.md` | Search-first before adding new helper |

## 2. CSS Tokens (full inventory from `web/css/style.css:1-64`)

```
Surface : --c-bg #fafaf9, --c-card #ffffff, --c-hairline #e7e5e4,
          --c-border #d6d3d1, --c-track #f4f4f5
Text    : --c-ink #18181b, --c-body #3f3f46, --c-muted #71717a, --c-subtle #a1a1aa
Rose    : --c-rose #e11d48, --c-rose-strong #be123c,
          --c-rose-soft #fff1f2, --c-rose-border #fecdd3
Emerald : --c-emerald #16a34a, --c-emerald-strong #15803d, --c-emerald-soft #dcfce7
Log     : --c-blue #2563eb, --c-orange #c2410c
Prompt  : --c-prompt #dc2626
Radius  : --r-sm 6, --r-md 8, --r-lg 12, --r-xl 16, --r-full 9999
Spacing : --s-xs 4, --s-sm 8, --s-md 12, --s-base 16, --s-lg 24, --s-xl 32
Font    : --font-sans, --font-mono
Motion  : --motion-fast 150ms, --motion-base 200ms
```

**Rose accent: `#e11d48`** is THE primary action color. AI bubble accent / save button must use `--c-rose` (solid) per existing `.send-btn` / `.conn-action[data-variant='solid']` pattern.

## 3. App-shell Layout (CRITICAL for view-switcher)

`web/css/style.css:110-119`:

```css
.app-shell {
  display: grid;
  grid-template-rows: auto auto 1fr auto auto;
  height: 100vh;
  /* ... */
}
```

5 grid rows in order: `topbar | connection-bar | terminal-card(1fr) | command-bar | control-cards`.

**Implication**: when AI view is active, the `1fr` row must be filled by `ai-card`. Strategy:

- Add `<section class="ai-card" hidden>...</section>` as a **sibling of `.terminal-card`** in the same grid row position
- CSS rules:
  - `[data-view='terminal'] .ai-card { display: none; }`
  - `[data-view='ai'] .terminal-card { display: none; }`
  - `[data-view='ai'] .command-bar { display: none; }`
  - both views: `.connection-bar` and `.control-cards` always visible (no rule needed)

Default `data-view` = `'terminal'` (set in HTML).

## 4. State-Driven Dimming (`web/css/style.css:683-699`)

```css
[data-state='disconnected'] .control-cards,
[data-state='error'] .control-cards { opacity: 0.5; pointer-events: none; }
[data-state='disconnected'] .command-bar,
[data-state='error'] .command-bar { opacity: 0.5; pointer-events: none; }
```

⚠️ AI view下 `.command-bar` 隐藏，但是 `.control-cards` 仍然受 ws state 影响（断开时 dimmed 是合理的）。**不需要修改这段规则**。

## 5. Module Wiring Patterns (`web/js/main.js:1-86`)

Canonical pattern (must follow):

```js
// 1. Import factory
import { createXxx } from './xxx-panel.js';

// 2. Lookup DOM via helper (only in main.js)
const xElem = requireElement('xId');

// 3. Instantiate with deps + callbacks
const xPanel = createXxx({
  elemA: requireElement('aId'),
  elemB: requireElement('bId'),
  onSomething(args) {
    // wire to other modules
  },
});
```

`requireElement(id)` is at `main.js:7-13` — throws if missing. Any new DOM IDs added to `index.html` must be looked up via this helper.

## 6. localStorage Pattern (`web/js/config-panel.js:9-58`)

Mirror this for `ai-panel.js`:

```js
const AI_STORAGE_KEYS = {
  apiKey: 'console.ai.apiKey',
  baseUrl: 'console.ai.baseUrl',
  model: 'console.ai.model',
};

const AI_DEFAULTS = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
};

function readAiConfig() {
  return {
    apiKey: localStorage.getItem(AI_STORAGE_KEYS.apiKey) || '',
    baseUrl: localStorage.getItem(AI_STORAGE_KEYS.baseUrl) || AI_DEFAULTS.baseUrl,
    model: localStorage.getItem(AI_STORAGE_KEYS.model) || AI_DEFAULTS.model,
  };
}

function writeAiConfig({ apiKey, baseUrl, model }) {
  localStorage.setItem(AI_STORAGE_KEYS.apiKey, apiKey);
  localStorage.setItem(AI_STORAGE_KEYS.baseUrl, baseUrl);
  localStorage.setItem(AI_STORAGE_KEYS.model, model);
}
```

## 7. control-panel.js Exports (`web/js/control-panel.js:53-57`) — ✅ READY

```js
return {
  setLedState,
  setMotorSpeed,
};
```

Both setters exist. `main.js:120` already exports `controlPanel`. AI tool execution path:

```
ai tool_call → main.js#sendControl(payload) → ws-client.send(...)
                                            → controlPanel.setLedState(true)  // sync UI
```

## 8. View-Toggle Existing Code (`web/js/main.js:101-112`) — TO REPLACE

Current:
```js
document.querySelectorAll('.view-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const parent = btn.parentElement;
    parent.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    if (btn.dataset.view === 'ai') {
      console.info('[placeholder] AI助手 view not implemented yet');
    }
  });
});
```

→ Replace with `createViewSwitcher({ shell, buttons }).setView(name)` factory call. Module owns:
- `aria-pressed` flip across sibling buttons
- `.app-shell[data-view]` set
- (no localStorage for view — view doesn't persist across reload per Q4)

## 9. xterm Behavior When Hidden (`web/js/terminal.js:14-55`)

`Terminal` instance + `FitAddon` + `ResizeObserver` are created in `createConsoleTerminal()`. Hiding `.terminal-card` via `display: none` does NOT dispose them. ResizeObserver may fire once when container hides (size→0); FitAddon will gracefully no-op for zero size. When user switches back to terminal view, ResizeObserver fires again on resize and FitAddon re-fits. **Safe to hide.**

## 10. ESLint / Prettier

- `eslint.config.js:25-33`: `web/js/**/*.js` uses ECMAScript latest, ESM, browser globals, `js.configs.recommended` rules
- `.prettierrc.json`: `semi: true, singleQuote: true, trailingComma: 'es5', printWidth: 100, tabWidth: 2, endOfLine: 'lf'`
- `web/vendor/**` is ignored — never put new code there

## 11. Files to Modify (final table)

| File | Action | One-line purpose |
|---|---|---|
| `web/js/ai-panel.js` | NEW | DeepSeek fetch + SSE + tool_call dispatch + bubble UI + config bar (single owner of `console.ai.*`) |
| `web/js/view-switcher.js` | NEW | Single owner of `.app-shell[data-view]` + `.view-toggle` aria-pressed sync |
| `web/index.html` | EDIT | Add `<section class="ai-card" id="aiCard" hidden>...</section>` sibling to `.terminal-card`; add `data-view="terminal"` to `.app-shell` |
| `web/js/main.js` | EDIT | Remove placeholder lines 101-112; import and wire `createAiPanel` and `createViewSwitcher`; add `onTool(payload)` → `sendControl(payload)` + sync `controlPanel.setLedState`/`setMotorSpeed` |
| `web/css/style.css` | EDIT | Add `.ai-card`, `.ai-config-bar`, `.ai-bubbles`, `.ai-bubble`, `.ai-input-bar`, `[data-view]` switching rules |
| `web/js/control-panel.js` | VERIFY ONLY | Already exports `setLedState` / `setMotorSpeed` (line 53-57) — no edit needed |
| `.trellis/spec/frontend/quality-guidelines.md` | UPDATE AT END | Per PRD §13 — add AI panel scenario, module table row, localStorage table row, remove placeholder line for AI 助手 |

## 12. Risks / Surprises

1. **Prototype-rose.html has no AI mockup** (`docs/design/prototype-rose.html:1142` says "visual-only in prototype"). Implementation must design AI bubbles within rose token system. Use `--c-rose-soft` for user bubble bg, `--c-card` + `--c-hairline` for AI bubble bg, `--c-rose-soft` + `--c-rose-strong` for system error bubble.

2. **Global `button { background: none; cursor: pointer; }`** at `style.css:97-101` — affects all buttons. AI send button must explicitly set bg per `.send-btn` pattern (`style.css:464-481`).

3. **`.app-shell` gap is `var(--s-md)` (12px)** — ai-card top margin not needed; gap handles it.

4. **`100vh` + `overflow: hidden`** — ai-bubbles container MUST be `flex: 1; min-height: 0; overflow: auto;` to scroll internally without overflowing the shell.

5. **`localStorage.getItem` returns `string | null`** — already handled in pattern at `config-panel.js:38-50`.

6. **No `console.ai.*` keys exist** anywhere in codebase (verified by absence of grep hits) — clean slate.

7. **`button:disabled { opacity: 0.6 }`** is on `.conn-action` and `.send-btn` only. AI send button needs same.

8. **`fetch` SSE parsing**: must use `response.body.getReader()` + `TextDecoder` + line buffering by `\n\n`. Standard pattern, no library needed.

## 13. Implementation Sketch (for implement subagent)

```
ai-panel.js  (~350 lines)
├─ Constants: AI_STORAGE_KEYS, AI_DEFAULTS, SYSTEM_PROMPT, TOOLS
├─ readAiConfig() / writeAiConfig() — single owner
├─ createAiPanel({...elements, onTool, isWsConnected}) — factory
│  ├─ State: messages[], streaming flag, current ai bubble ref
│  ├─ DOM helpers: appendBubble(role, text), appendToolBadge(toolName, status), appendErrorBubble(msg)
│  ├─ Config bar: renderConfigBar() — shows mask key + model dropdown + edit
│  ├─ Empty state: when apiKey is '', render the centered config form
│  ├─ submitMessage(text):
│  │   1. push to messages, append user bubble
│  │   2. fetch DeepSeek with stream:true + tools
│  │   3. parse SSE chunks:
│  │       - delta.content → append to ai bubble
│  │       - delta.tool_calls[i].function.{name,arguments} → accumulate
│  │   4. on stream done + finish_reason='tool_calls':
│  │       - JSON.parse arguments, validate (motor_speed range etc.)
│  │       - if isWsConnected(): call onTool(payload), append ✓
│  │       - else: append ⚠ 设备未连接
│  │   5. on HTTP error: append red system bubble
│  │   6. drop tool_calls from history before next round (D8 strategy i)
│  └─ Returns { setView: noop ?, focus(): ... }
│
view-switcher.js  (~40 lines)
├─ createViewSwitcher({ shell, buttons })
│  ├─ setView(name): flip aria-pressed, set shell.dataset.view = name
│  ├─ Click handlers wire buttons to setView
│  └─ Returns { setView }
│
main.js  (~30 lines added)
├─ Remove placeholder lines 101-112
├─ Import createAiPanel, createViewSwitcher
├─ Initialize aiPanel with onTool callback that:
│   1. client.send({from:'web', type:'cmd', payload}) (reuse sendControl)
│   2. if payload.action === 'led_on': controlPanel.setLedState(true)
│   3. if payload.action === 'led_off': controlPanel.setLedState(false)
│   4. if payload.action === 'motor_speed': controlPanel.setMotorSpeed(payload.value)
├─ Initialize viewSwitcher
└─ Initial setView('terminal') on load
```
