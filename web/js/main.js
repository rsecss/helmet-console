import { createAiPanel } from './ai-panel.js';
import { createCommandPanel } from './command-panel.js';
import { createConfigPanel } from './config-panel.js';
import { createControlPanel } from './control-panel.js';
import { createConsoleTerminal } from './terminal.js';
import { createViewSwitcher } from './view-switcher.js';
import { createWsClient } from './ws-client.js';

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element;
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
  onFrame(frame) {
    if (frame.type !== 'pong') {
      terminal.writeFrame(frame);
    }
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

const commandPanel = createCommandPanel({
  form: requireElement('commandForm'),
  input: requireElement('commandInput'),
  sendButton: requireElement('sendCommandButton'),
  onSend(command) {
    sendControl(command);
  },
});

const controlPanel = createControlPanel({
  ledOnButton: requireElement('ledOnButton'),
  ledOffButton: requireElement('ledOffButton'),
  ledStatus: requireElement('ledStatus'),
  ledStatusValue: requireElement('ledStatusValue'),
  motorSlider: requireElement('motorSpeed'),
  motorValue: requireElement('motorValue'),
  onLedOn() {
    sendControl({ action: 'led_on' });
  },
  onLedOff() {
    sendControl({ action: 'led_off' });
  },
  onMotorSpeed(value) {
    sendControl({ action: 'motor_speed', value });
  },
});

function sendControl(payload) {
  client.send({
    from: 'web',
    type: 'cmd',
    payload,
  });
}

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
  onTool(payload) {
    sendControl(payload);
    if (payload.action === 'led_on') controlPanel.setLedState(true);
    else if (payload.action === 'led_off') controlPanel.setLedState(false);
    else if (payload.action === 'motor_speed') controlPanel.setMotorSpeed(payload.value);
  },
  isWsConnected: () => client.isConnected(),
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

// Re-exports for future integration (LED state mirroring from device frames).
export { controlPanel };
