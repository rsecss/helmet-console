// One-off harness that exercises createControlPanel without a real DOM.
// Verifies every motor-related Acceptance Criterion from prd.md by stubbing
// elements with the minimum surface control-panel.js touches: addEventListener,
// setAttribute / getAttribute, dataset, textContent, plus a `_click()` helper.
// Lives under the task dir so it gets archived together with the task.
//
// Run: node .trellis/tasks/05-04-panel-view/ui-harness.mjs

import { createControlPanel } from '../../../web/js/control-panel.js';

function stubElement(extra = {}) {
  const handlers = new Map();
  const attrs = new Map();
  const el = {
    _handlers: handlers,
    _attrs: attrs,
    dataset: {},
    _text: '',
    addEventListener(event, handler) {
      handlers.set(event, handler);
    },
    setAttribute(name, value) {
      attrs.set(name, value);
    },
    getAttribute(name) {
      return attrs.get(name);
    },
    _click() {
      const h = handlers.get('click');
      if (!h) throw new Error('No click handler bound');
      h();
    },
    ...extra,
  };
  Object.defineProperty(el, 'textContent', {
    get() {
      return this._text;
    },
    set(v) {
      this._text = v;
    },
  });
  return el;
}

let pass = 0;
let fail = 0;
function assertEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass += 1;
    console.info(`  OK ${label}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${label}: expected ${e}, got ${a}`);
  }
}

// ---- Build mocks ----------------------------------------------------------

const ledOnButton = stubElement();
const ledOffButton = stubElement();
const ledStatus = stubElement();
const ledStatusValue = stubElement();
const motorOnButton = stubElement();
const motorOffButton = stubElement();
const motorGearButtons = [1, 2, 3].map((g) => stubElement({ dataset: { gear: String(g) } }));
const motorDisplay = stubElement();
const motorStateValue = stubElement();
const motorGearValue = stubElement();

const sentCommands = [];
const ledLog = [];

const controlPanel = createControlPanel({
  ledOnButton,
  ledOffButton,
  ledStatus,
  ledStatusValue,
  motorOnButton,
  motorOffButton,
  motorGearButtons,
  motorDisplay,
  motorStateValue,
  motorGearValue,
  onLedOn: () => ledLog.push('on'),
  onLedOff: () => ledLog.push('off'),
  onMotorSpeed: (n) => sentCommands.push(n),
});

// ---- Initial state (PRD: default switch OFF + gear 1, no command) --------

console.info('[1] Initial state');
assertEq(motorOnButton.getAttribute('aria-pressed'), 'false', 'switch ON not pressed');
assertEq(motorOffButton.getAttribute('aria-pressed'), 'true', 'switch OFF pressed');
assertEq(motorGearButtons[0].getAttribute('aria-pressed'), 'true', 'gear 1 pressed');
assertEq(motorGearButtons[1].getAttribute('aria-pressed'), 'false', 'gear 2 not pressed');
assertEq(motorGearButtons[2].getAttribute('aria-pressed'), 'false', 'gear 3 not pressed');
assertEq(motorStateValue.textContent, '已停止', 'state text');
assertEq(motorGearValue.textContent, '1', 'gear text');
assertEq(motorDisplay.dataset.state, 'off', 'motor display state');
assertEq(sentCommands, [], 'no commands sent at init');

// ---- Passive memory (PRD Q5.1) -------------------------------------------

console.info('[2] Passive memory: switch OFF + click gear 2');
motorGearButtons[1]._click();
assertEq(motorGearButtons[1].getAttribute('aria-pressed'), 'true', 'gear 2 highlighted');
assertEq(motorGearButtons[0].getAttribute('aria-pressed'), 'false', 'gear 1 unhighlighted');
assertEq(motorOnButton.getAttribute('aria-pressed'), 'false', 'switch still OFF');
assertEq(motorGearValue.textContent, '2', 'gear text updated to 2');
assertEq(sentCommands, [], 'still no commands sent');

// ---- Switch ON sends current gear (2) -----------------------------------

console.info('[3] Switch ON sends current gear');
motorOnButton._click();
assertEq(sentCommands, [2], 'sent motor_speed value 2');
assertEq(motorOnButton.getAttribute('aria-pressed'), 'true', 'switch ON pressed');
assertEq(motorOffButton.getAttribute('aria-pressed'), 'false', 'switch OFF unpressed');
assertEq(motorStateValue.textContent, '运行中', 'state text running');
assertEq(motorDisplay.dataset.state, 'on', 'display state on');

// ---- Click gear 3 while ON sends new gear -------------------------------

console.info('[4] Click gear 3 while running');
motorGearButtons[2]._click();
assertEq(sentCommands, [2, 3], 'sent motor_speed value 3');
assertEq(motorGearButtons[2].getAttribute('aria-pressed'), 'true', 'gear 3 highlighted');
assertEq(motorGearButtons[1].getAttribute('aria-pressed'), 'false', 'gear 2 unhighlighted');

// ---- Switch OFF preserves gear (PRD Q5.3) -------------------------------

console.info('[5] Switch OFF preserves gear');
motorOffButton._click();
assertEq(sentCommands, [2, 3, 0], 'sent motor_speed value 0');
assertEq(motorOffButton.getAttribute('aria-pressed'), 'true', 'switch OFF pressed');
assertEq(motorGearButtons[2].getAttribute('aria-pressed'), 'true', 'gear 3 still highlighted');
assertEq(motorStateValue.textContent, '已停止', 'state text stopped');

// ---- Mirror inbound motor_speed_<n> --------------------------------------

console.info('[6] mirrorControlState boundary');
controlPanel.setMotorSpeed(1);
assertEq(motorOnButton.getAttribute('aria-pressed'), 'true', 'mirror 1: switch ON');
assertEq(motorGearButtons[0].getAttribute('aria-pressed'), 'true', 'mirror 1: gear 1');
assertEq(sentCommands.length, 3, 'mirror does not emit outbound');

controlPanel.setMotorSpeed(0);
assertEq(motorOnButton.getAttribute('aria-pressed'), 'false', 'mirror 0: switch OFF');
assertEq(motorGearButtons[0].getAttribute('aria-pressed'), 'true', 'mirror 0: gear preserved at 1');

// ---- Out-of-range rejection (PRD Q5.3) ----------------------------------

console.info('[7] Out-of-range frame is dropped with warn');
const warnings = [];
const origWarn = console.warn;
console.warn = (...args) => warnings.push(args);
controlPanel.setMotorSpeed(4);
controlPanel.setMotorSpeed(5);
console.warn = origWarn;
assertEq(warnings.length, 2, 'console.warn fired twice');
assertEq(motorOnButton.getAttribute('aria-pressed'), 'false', 'state unchanged after out-of-range');

// ---- LED regression (no behavior change) --------------------------------

console.info('[8] LED on/off regression');
ledOnButton._click();
assertEq(ledLog, ['on'], 'LED on callback fired');
assertEq(ledStatus.dataset.state, 'on', 'LED status state on');
assertEq(ledStatusValue.textContent, '已开启', 'LED status text on');

ledOffButton._click();
assertEq(ledLog, ['on', 'off'], 'LED off callback fired');
assertEq(ledStatus.dataset.state, 'off', 'LED status state off');
assertEq(ledStatusValue.textContent, '已关闭', 'LED status text off');

// ---- Summary -------------------------------------------------------------

console.info(`\n[ui-harness] ${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exitCode = 1;
}
