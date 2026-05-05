# Add panel view with reworked motor controls and reserved telemetry slot

## Goal

Introduce a third top-level view ("面板") that hosts device controls (LED + motor)
relocated from their current always-visible position, redesign the motor card
to use a switch + 3-gear segmented selector with a status display section, and
reserve a DOM/code seam for future device telemetry / chart rendering — all
without changing the byte-pass-through WS contract.

## Requirements

### View architecture
- Add a third tab "面板" to the right of "AI助手" in the topbar `view-toggle` group.
- `view-switcher` value enum extends from `'terminal' | 'ai'` to `'terminal' | 'ai' | 'panel'`.
- `topbar` and `connection-bar` remain visible in all three views.
- `command-bar` is shown **only** in the `terminal` view (hidden in `ai` and `panel`).
- `terminal-card` is shown only in `terminal` view.
- `ai-card` is shown only in `ai` view.
- `control-cards` (LED + motor) and the new `data-card` are shown **only** in the `panel` view.
  This is a behavior change: control cards previously rendered in all views.

### LED — unchanged
- LED stays binary on/off. WS commands `led_on` / `led_off` and the AI tools `led_on` / `led_off`
  are not modified. The LED card is relocated into the panel view as-is.

### Motor — reworked
- Conceptual model: **switch is the power gate, gear is the target speed.**
- Gear range narrowed from 0–5 to **1–3**.
- WS protocol unchanged in shape (`motor_speed_<n>`), only the value range narrows to 0–3.
  - 0 is reserved for the "off" frame emitted by the switch OFF button; UI never offers a "0" gear.
- AI tool `motor_speed` parameter range updated to `minimum: 0, maximum: 3`. Description updated
  to "0=停止，3=最高速".
- Card layout (panel view):
  - Display section (read-only):
    - 状态: ●运行中 / 已停止 (driven by switch state)
    - 目标档位: <1|2|3>
    - 实际转速: -- rpm (待接入) — placeholder text only
  - Switch: 2-button segmented `[开][关]`, single-writer of switch state.
  - Gear: 3-button segmented `[1][2][3]`, single-writer of gear state.
- Existing motor `slider` is removed; `.motor-slider-wrap` and slider-specific CSS go with it.
- UX edge cases:
  - Switch OFF + click gear → highlight changes locally, **no WS frame emitted**.
  - Default state on first load: switch=OFF, gear=1 highlighted, no command sent at init.
  - Click switch ON → sends `motor_speed_<currentGear>`.
  - Click switch OFF → sends `motor_speed_0`, gear highlight is **preserved**.
  - `mirrorControlState('motor_speed_0')` → switch OFF, keep gear highlight.
  - `mirrorControlState('motor_speed_<1..3>')` → switch ON, gear ← that value.
  - `mirrorControlState('motor_speed_<4|5>')` → `console.warn` and drop, no UI change.

### Reserved telemetry slot
- DOM: a new `.data-card` rendered below the control cards in the panel view.
- Visual: full-width single card; chart-icon glyph + two lines of muted placeholder text
  ("实时数据" / "下位机上传实时数据后将在此显示").
- Code seam: `main.js` registers the card via the existing `reservePlaceholder()` helper
  → click logs `console.info('[placeholder] 实时数据 not implemented yet')`.
- A multi-line comment block above the registration documents the integration steps for the
  future implementer (parse incoming frames, replace placeholder, vendor chart lib, see spec).
- Disconnected state: control cards still dim per existing rule; data card stays normal opacity.

### Spec documentation
- `spec/frontend/quality-guidelines.md`: extend view enum to include `panel`; document panel
  view contents; update motor command range to `0..3` (multiple sites: lines ~151, ~210, ~549,
  ~583-587, ~602); document switch/gear two-axis state.
- `spec/frontend/state-management.md`: extend `data-view` valid values to three; replace motor
  single-value model with `(switch: bool, gear: 1..3)` two-axis description; update widget-state
  table; include the mirror rules.
- `spec/frontend/type-safety.md`: update the `motor_speed` `translateTool` example
  (line ~118) to use upper bound `3`.
- `spec/backend/quality-guidelines.md`: add §Telemetry (Deferred) noting that future
  telemetry frames stay byte-pass-through (no envelope, no JSON); update the motor
  command row at line ~107 from `motor_speed_<0..5>` to `motor_speed_<0..3>`.
- `docs/architecture.md`: update protocol table at line ~209 (`motor_speed_<0..5>` → `<0..3>`)
  and the module description at line ~92 ("LED 开关 + 电机滑块" → reflect new motor controls);
  update the AI sequence diagram if the value range matters.
- `docs/interface.md`: update the WS table at line ~32 (`motor_speed_<0..5>` → `<0..3>`).

> Out of scope for spec sync: `docs/design/prototype-rose.html` and `docs/design/prototype.html`
> are frozen v0 design references; we do **not** retro-edit them. The frontend index already
> calls prototype-rose "the visual surface of truth" — for this task the surface of truth is
> the live `web/` code, and the prototype represents the pre-panel-view snapshot.

## Acceptance Criteria

### Automated (must pass)
- [ ] `npm run lint` — 0 error
- [ ] `npm run format:check` — 0 diff
- [ ] `npm test` (lint + smoke) — pass

### Manual — view switching
- [ ] Three tabs each render the correct combination per the table above.
- [ ] `topbar` and `connection-bar` remain in all three views.
- [ ] `command-bar` is hidden in `ai` and `panel`, present in `terminal`.
- [ ] No horizontal scroll at any viewport width supported today (320 min).

### Manual — LED regression (no behavior change)
- [ ] In panel view, LED 开/关 buttons send `led_on` / `led_off` over WS.
- [ ] AI tool `led_on` / `led_off` mirrors UI state via `mirrorControlState`.

### Manual — Motor new behavior
- [ ] On first load: switch=OFF, gear=1 highlighted, no frame on the wire.
- [ ] Switch OFF + click gear 2 → gear 2 highlights, no frame emitted.
- [ ] Then click switch ON → emits `motor_speed_2`.
- [ ] Click switch OFF → emits `motor_speed_0`, gear 2 still highlighted.
- [ ] AI tool `motor_speed({value: 3})` → emits `motor_speed_3`, UI mirrors switch=ON / gear=3.
- [ ] AI tool `motor_speed({value: 5})` → tool reports "参数越界", no frame emitted.
- [ ] Simulated incoming `motor_speed_4` (e.g. via `ws-cli`) → `console.warn` logged, UI unchanged.

### Manual — Reserved data card
- [ ] Panel view renders the data card below control cards, full width.
- [ ] Click data card → DevTools console shows `[placeholder] 实时数据 not implemented yet`.
- [ ] In disconnected state, data card stays normal opacity (control cards still dim).

## Technical Notes

### Files expected to change
- `web/index.html` — add `panel` tab; restructure motor card; add data card
- `web/css/style.css` — `[data-view='panel']` rules; motor segmented buttons; data card styles;
  remove obsolete slider CSS sections that no longer apply
- `web/js/view-switcher.js` — extend `VALID_VIEWS` set
- `web/js/control-panel.js` — replace motor slider with switch + gear segmented controls;
  implement passive-memory behavior; expose `setMotorState({on, gear})` plus retain
  `setMotorSpeed(value)` for `mirrorControlState` compatibility (or refactor that path)
- `web/js/main.js` — wire new motor handlers; add `reservePlaceholder('.data-card', '实时数据')`
  with a documenting comment block; trigger initial view via `viewSwitcher.setView('terminal')`
- `web/js/ai-panel.js` — update `motor_speed` tool description and `maximum` to 3; update
  validator in `translateTool`
- `.trellis/spec/frontend/quality-guidelines.md` — view enum, motor range, two-axis state
- `.trellis/spec/frontend/state-management.md` — motor dual-axis description
- `.trellis/spec/backend/quality-guidelines.md` — §Telemetry (Deferred); motor range update

### Files explicitly NOT changed
- `web/js/terminal.js` — display-only stays display-only
- `web/js/config-panel.js` — sole writer of `data-state`, no changes needed
- `web/js/ws-client.js` — no signature change; no parser added; data routing comment goes in `main.js`
- `server/src/*` — backend stays byte-pass-through; no new verbs

### Commit cadence (2 commits)
- C1: `feat(web): add panel view tab and relocate device controls into it`
  - HTML: add panel tab, wrap LED+motor in panel view, no behavior change
  - CSS: `[data-view='panel']` show rules, hide rules for terminal+ai
  - JS: `view-switcher.js` enum extension only
- C2: `feat(web): rework motor card to switch + 3-gear with reserved telemetry slot`
  - HTML/CSS: motor card redesign; data card placeholder
  - JS: `control-panel.js` motor refactor; `main.js` data card seam; `ai-panel.js` motor range
  - Spec: three doc updates

### Out of scope (explicitly deferred)
- Real telemetry frame parser
- Chart library vendoring
- Device-side firmware command set updates (project owner's responsibility)
- New AI tools beyond updating motor range
