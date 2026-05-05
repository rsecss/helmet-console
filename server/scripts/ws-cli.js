import readline from 'node:readline';

import WebSocket from 'ws';

import { config } from '../src/config.js';

const DEFAULT_URL = `ws://127.0.0.1:${config.port}${config.wsPath}`;

const arg = process.argv[2];
if (arg === '-h' || arg === '--help') {
  console.info('Usage: node server/scripts/ws-cli.js [ws-url]');
  console.info(`Default: ${DEFAULT_URL}`);
  console.info('Type a line + Enter to send a text frame; Ctrl+C to disconnect.');
  process.exit(0);
}

const url = arg || DEFAULT_URL;

let exitCode = 0;
let closing = false;
const pending = [];

const rl = readline.createInterface({
  input: process.stdin,
  terminal: process.stdin.isTTY,
});

console.info(`[ws-cli] connecting to ${url}`);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.info('[ws-cli] connected');
  while (pending.length > 0) {
    ws.send(pending.shift());
  }
});

ws.on('message', (data, isBinary) => {
  if (isBinary) {
    console.warn(`[ws-cli] dropped binary frame (${data.length} bytes)`);
    return;
  }
  process.stdout.write(data.toString('utf8'));
});

ws.on('error', (err) => {
  console.error(`[ws-cli] error: ${err.message}`);
  exitCode = 1;
});

ws.on('close', (code) => {
  console.info(`[ws-cli] closed (code=${code})`);
  rl.close();
  process.exit(exitCode);
});

rl.on('line', (line) => {
  if (!line) {
    return;
  }
  const frame = line.endsWith('\n') ? line : `${line}\n`;
  if (ws.readyState === WebSocket.CONNECTING) {
    pending.push(frame);
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
    console.warn('[ws-cli] not connected; dropped input');
    return;
  }
  ws.send(frame);
});

function shutdown() {
  if (closing) {
    return;
  }
  closing = true;
  console.info('[ws-cli] closing');
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
    ws.close(1000);
  } else {
    rl.close();
    process.exit(exitCode);
  }
}

rl.on('SIGINT', shutdown);
process.on('SIGINT', shutdown);
rl.on('close', shutdown);
