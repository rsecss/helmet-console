import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import { createWsClient } from '../web/js/ws-client.js';

let originalWindow;
let originalWebSocket;
let timers;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.listeners = new Map();
    this.sent = [];
    this.closeCode = null;
    this.closeReason = '';
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type, event = {}) {
    if (type === 'open') this.readyState = FakeWebSocket.OPEN;
    if (type === 'close') this.readyState = FakeWebSocket.CLOSED;
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
  }

  close(code = 1000, reason = '') {
    this.readyState = FakeWebSocket.CLOSED;
    this.closeCode = code;
    this.closeReason = reason;
  }

  send(text) {
    this.sent.push(text);
  }
}

function installBrowserMocks() {
  timers = new Set();
  originalWindow = globalThis.window;
  originalWebSocket = globalThis.WebSocket;
  FakeWebSocket.instances = [];

  globalThis.window = {
    clearTimeout,
    clearInterval,
    setTimeout(fn, delay, ...args) {
      const id = setTimeout(fn, delay, ...args);
      timers.add(id);
      return id;
    },
    setInterval(fn, delay, ...args) {
      const id = setInterval(fn, delay, ...args);
      timers.add(id);
      return id;
    },
  };
  globalThis.WebSocket = FakeWebSocket;
}

function restoreBrowserMocks() {
  for (const id of timers || []) {
    clearTimeout(id);
    clearInterval(id);
  }
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
  if (originalWebSocket === undefined) {
    delete globalThis.WebSocket;
  } else {
    globalThis.WebSocket = originalWebSocket;
  }
}

function createClient() {
  const statuses = [];
  const frames = [];
  const logs = [];
  const client = createWsClient({
    onStatus: (status) => statuses.push(status),
    onFrame: (frame) => frames.push(frame),
    onLog: (message) => logs.push(message),
  });
  return { client, statuses, frames, logs };
}

beforeEach(installBrowserMocks);
afterEach(restoreBrowserMocks);

test('ignores a stale close after manual disconnect and immediate reconnect', () => {
  const { client, statuses, logs } = createClient();

  client.connect('ws://example.test/ws');
  const first = FakeWebSocket.instances[0];
  first.emit('open');

  client.disconnect();
  client.connect('ws://example.test/ws');
  const second = FakeWebSocket.instances[1];
  second.emit('open');

  first.emit('close', { code: 1000 });

  assert.equal(client.isConnected(), true);
  assert.deepEqual(
    statuses.map((status) => status.name),
    ['connecting', 'connected', 'disconnected', 'connecting', 'connected']
  );
  assert.deepEqual(logs, []);
});

test('ignores a stale open from an older connection attempt', () => {
  const { client, statuses } = createClient();

  client.connect('ws://example.test/ws');
  const first = FakeWebSocket.instances[0];
  client.connect('ws://example.test/ws');
  const second = FakeWebSocket.instances[1];

  first.emit('open');

  assert.equal(client.isConnected(), false);
  assert.equal(first.closeReason, 'stale connection');
  assert.deepEqual(
    statuses.map((status) => status.name),
    ['connecting', 'connecting']
  );

  second.emit('open');

  assert.equal(client.isConnected(), true);
  assert.deepEqual(
    statuses.map((status) => status.name),
    ['connecting', 'connecting', 'connected']
  );
});
