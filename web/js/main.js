import { createCommandPanel } from './command-panel.js';
import { createConfigPanel } from './config-panel.js';
import { createConsoleTerminal } from './terminal.js';
import { createWsClient } from './ws-client.js';

const statusLabels = {
  disconnected: '未连接',
  connecting: '连接中',
  connected: '已连接',
  reconnecting: '重连中',
  error: '错误',
};

function requireElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element;
}

const statusText = requireElement('statusText');
const terminal = createConsoleTerminal({
  container: requireElement('terminal'),
});

const client = createWsClient({
  onStatus({ name, detail }) {
    const label = statusLabels[name] || name;
    statusText.textContent = detail ? `${label} ${detail}` : label;
    statusText.className = `status status-${name}`;
    panel.setConnected(name === 'connected');
    commandPanel.setConnected(name === 'connected');
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

const panel = createConfigPanel({
  form: requireElement('configForm'),
  hostInput: requireElement('wsHost'),
  portInput: requireElement('wsPort'),
  pathInput: requireElement('wsPath'),
  tlsInput: requireElement('wsTls'),
  connectButton: requireElement('connectButton'),
  disconnectButton: requireElement('disconnectButton'),
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

function sendControl(payload) {
  client.send({
    from: 'web',
    type: 'cmd',
    payload,
  });
}

requireElement('ledOnButton').addEventListener('click', () => {
  sendControl({ action: 'led_on' });
});

requireElement('ledOffButton').addEventListener('click', () => {
  sendControl({ action: 'led_off' });
});

requireElement('motorSpeed').addEventListener('input', (event) => {
  sendControl({ action: 'motor_speed', value: Number(event.target.value) });
});
