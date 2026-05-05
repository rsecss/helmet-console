import { createAiPanel } from './ai-panel.js';
import { createCommandPanel } from './command-panel.js';
import { createConfigPanel } from './config-panel.js';
import { createControlPanel } from './control-panel.js';
import { createConsoleTerminal } from './terminal.js';
import { createViewSwitcher } from './view-switcher.js';
import { createWsClient } from './ws-client.js';

const PONG = 'pong';
const MOTOR_PREFIX = 'motor_speed_';
const LED_COLOR_PREFIX = 'led_color_';
const LED_COLORS = new Set(['white', 'red', 'green']);
// Display-layer direction markers (xterm only — wire stays byte-passthrough).
// Convention: ↓ = downstream control (this browser → device/peer),
//             ↑ = upstream feedback (device/peer → this browser).
// ANSI 31 = red (high-attention control out), 34 = blue (info in); 0 resets so
// device-side ANSI colors still render normally after the marker.
const TX_PREFIX = '\x1b[31m[↓]\x1b[0m';
const RX_PREFIX = '\x1b[34m[↑]\x1b[0m';

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element;
}

function stripTrailingNewline(text) {
  return text.replace(/\r?\n$/, '');
}

function ensureTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

function mirrorControlState(command) {
  if (command === 'led_on') {
    controlPanel.setLedState('white');
    return;
  }
  if (command === 'led_off') {
    controlPanel.setLedState('off');
    return;
  }
  if (command.startsWith(LED_COLOR_PREFIX)) {
    const color = command.slice(LED_COLOR_PREFIX.length);
    if (LED_COLORS.has(color)) {
      controlPanel.setLedState(color);
    }
    return;
  }
  if (command.startsWith(MOTOR_PREFIX)) {
    const value = Number.parseInt(command.slice(MOTOR_PREFIX.length), 10);
    if (Number.isInteger(value)) {
      controlPanel.setMotorSpeed(value);
    }
  }
}

const shell = requireElement('appShell');
const terminal = createConsoleTerminal({
  container: requireElement('terminal'),
});

const client = createWsClient({
  onStatus({ name, detail }) {
    configPanel.setStatus({ name, detail });
    const isConnected = name === 'connected';
    commandPanel.setConnected(isConnected);
  },
  onFrame(text) {
    if (stripTrailingNewline(text) === PONG) {
      return;
    }
    // TODO(state-mirror): parse `state:` frames here for cross-client UI mirroring.
    const body = text.endsWith('\n') ? text : `${text}\n`;
    terminal.writeText(`${RX_PREFIX}${body}`);
  },
  onLog(message) {
    terminal.writeLine(message);
  },
});

const configPanel = createConfigPanel({
  shell,
  form: requireElement('configForm'),
  urlInput: requireElement('wsUrl'),
  statusPill: requireElement('statusPill'),
  actionButton: requireElement('connAction'),
  inlineError: requireElement('inlineError'),
  onConnect(url) {
    terminal.writeLine(`[ws] connect ${url}`);
    client.connect(url);
  },
  onDisconnect() {
    terminal.writeLine('[ws] disconnect');
    client.disconnect();
  },
});

function isControlCommand(command) {
  if (command === 'led_on' || command === 'led_off') return true;
  if (command.startsWith(LED_COLOR_PREFIX)) {
    return LED_COLORS.has(command.slice(LED_COLOR_PREFIX.length));
  }
  if (command.startsWith(MOTOR_PREFIX)) {
    const value = Number.parseInt(command.slice(MOTOR_PREFIX.length), 10);
    return Number.isInteger(value) && value >= 0 && value <= 3;
  }
  return false;
}

function sendCommand(command) {
  const ok = client.send(ensureTrailingNewline(command));
  // Echo only on successful send. ws-client already calls onLog('[ws] not connected')
  // on failure, so the operator gets a single source of truth.
  if (ok) {
    terminal.writeText(`${TX_PREFIX}${command}\n`);
    if (isControlCommand(command)) {
      emitStateSnapshot();
    }
  }
}

function emitStateSnapshot() {
  const { led, motorOn, motorGear } = controlPanel.snapshot();
  const motor = motorOn ? motorGear : 0;
  const frame = `state:led=${led},motor=${motor}\n`;
  if (client.send(frame)) {
    terminal.writeText(`${TX_PREFIX}${frame}`);
  }
}

const commandPanel = createCommandPanel({
  form: requireElement('commandForm'),
  input: requireElement('commandInput'),
  sendButton: requireElement('sendCommandButton'),
  onSend(rawInput) {
    // Allow multi-line paste: split on \n, send each non-empty line as its
    // own frame so the device never has to handle frame boundaries itself.
    for (const line of rawInput.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) sendCommand(trimmed);
    }
  },
});

const motorGearButtons = Array.from(document.querySelectorAll('#motorGears .motor-gear-btn'));

const controlPanel = createControlPanel({
  ledOnButton: requireElement('ledOnButton'),
  ledOffButton: requireElement('ledOffButton'),
  ledStatus: requireElement('ledStatus'),
  ledStatusValue: requireElement('ledStatusValue'),
  motorOnButton: requireElement('motorOnButton'),
  motorOffButton: requireElement('motorOffButton'),
  motorGearButtons,
  motorDisplay: requireElement('motorDisplay'),
  motorStateValue: requireElement('motorStateValue'),
  motorGearValue: requireElement('motorGearValue'),
  onLedOn() {
    sendCommand('led_on');
  },
  onLedOff() {
    sendCommand('led_off');
  },
  onMotorSpeed(value) {
    sendCommand(`${MOTOR_PREFIX}${value}`);
  },
});

const aiPanel = createAiPanel({
  configBar: requireElement('aiConfigBar'),
  configKey: requireElement('aiConfigKey'),
  configModel: requireElement('aiConfigModel'),
  configEdit: requireElement('aiConfigEdit'),
  configForm: requireElement('aiConfigForm'),
  configFormTitle: requireElement('aiConfigFormTitle'),
  keyInput: requireElement('aiKeyInput'),
  baseUrlInput: requireElement('aiBaseUrlInput'),
  configCancel: requireElement('aiConfigCancel'),
  bubbles: requireElement('aiBubbles'),
  inputForm: requireElement('aiInputForm'),
  input: requireElement('aiInput'),
  sendButton: requireElement('aiSendButton'),
  statusQueryButton: requireElement('aiStatusQueryButton'),
  onTool(command) {
    mirrorControlState(command);
    sendCommand(command);
  },
  isWsConnected: () => client.isConnected(),
  getSnapshot: () => controlPanel.snapshot(),
});

const viewSwitcher = createViewSwitcher({
  shell,
  buttons: Array.from(document.querySelectorAll('.view-toggle button')),
  onViewChange(name) {
    if (name === 'ai') aiPanel.focus();
  },
});
viewSwitcher.setView('terminal');

// ============================================================
// Reserved-interface placeholders.
// DOM exists so QA can verify the slot; handler is a no-op
// that prints once per click. Wire real behavior in a later task.
// ============================================================
function reservePlaceholder(selector, label) {
  document.querySelectorAll(selector).forEach((node) => {
    node.addEventListener('click', () => {
      console.info(`[placeholder] ${label} not implemented yet`);
    });
  });
}

reservePlaceholder('.icon-btn[data-action="docs"]', '文档');
reservePlaceholder('.icon-btn[data-action="sidebar"]', '终端侧栏');
reservePlaceholder('.icon-btn[data-action="copy"]', '复制');
reservePlaceholder('.icon-btn[data-action="expand"]', '全屏');

// ============================================================
// Reserved telemetry seam — `.data-card` in the panel view.
// When the device-to-browser telemetry frame format is finalized:
//   1. Add a parser branch in `client.onFrame` (above) that recognizes
//      telemetry frames and routes them to a data-store / chart widget
//      instead of (or in addition to) `terminal.writeText`.
//   2. Replace the `.data-card` placeholder content with a chart widget
//      (e.g. uPlot, vendored under `web/vendor/`).
//   3. Drop the placeholder click handler below.
// Frame format: TBD — flat string, no JSON envelope. See
// `.trellis/spec/backend/quality-guidelines.md` §Telemetry (Deferred).
// ============================================================
reservePlaceholder('.data-card', '实时数据');

// Re-exports for future integration (LED state mirroring from device frames).
export { controlPanel };
