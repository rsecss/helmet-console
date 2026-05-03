import http from 'node:http';

import WebSocket from 'ws';

import { config } from '../src/config.js';
import { createStaticHandler } from '../src/static.js';
import { createWsRelay } from '../src/ws-relay.js';

const relay = createWsRelay({ ...config, maxClients: 4 });
const server = http.createServer(
  createStaticHandler({
    staticDir: config.staticDir,
    getClientCount: relay.getClientCount,
  })
);

server.on('upgrade', relay.handleUpgrade);

function listen() {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address());
    });
  });
}

async function requestHealth(port) {
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);

  if (!response.ok) {
    throw new Error(`/healthz returned ${response.status}`);
  }

  const body = await response.json();
  if (body.status !== 'ok' || typeof body.uptime !== 'number' || body.clients !== 0) {
    throw new Error(`/healthz returned unexpected body: ${JSON.stringify(body)}`);
  }
}

function openSocket(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${config.wsPath}`);

    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function nextMessage(ws, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);

    ws.once('message', (data, isBinary) => {
      clearTimeout(timer);
      resolve({ text: isBinary ? null : data.toString('utf8'), isBinary });
    });
  });
}

function nextClose(ws, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);

    ws.once('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function verifyBroadcast(port) {
  const sender = await openSocket(port);
  const receiver = await openSocket(port);

  try {
    const received = nextMessage(receiver, 1000, 'broadcast frame');
    sender.send('led_on\n');

    const { text, isBinary } = await received;
    if (isBinary) {
      throw new Error('Broadcast frame arrived as binary');
    }
    if (text !== 'led_on\n') {
      throw new Error(`Unexpected broadcast text: ${JSON.stringify(text)}`);
    }
  } finally {
    sender.close();
    receiver.close();
  }
}

async function verifyPingPong(port) {
  const ws = await openSocket(port);

  try {
    const reply = nextMessage(ws, 1000, 'pong frame');
    ws.send('ping\n');

    const { text, isBinary } = await reply;
    if (isBinary || text !== 'pong\n') {
      throw new Error(`Unexpected ping reply: isBinary=${isBinary} text=${JSON.stringify(text)}`);
    }
  } finally {
    ws.close();
  }
}

async function verifyBinaryRejected(port) {
  const ws = await openSocket(port);

  try {
    const closed = nextClose(ws, 1000, 'binary frame close');
    ws.send(Buffer.from([1, 2, 3]));

    const code = await closed;
    if (code !== 1003) {
      throw new Error(`Unexpected close code for binary frame: ${code}`);
    }
  } finally {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }
}

try {
  const address = await listen();
  await requestHealth(address.port);
  await verifyBroadcast(address.port);
  await verifyPingPong(address.port);
  await verifyBinaryRejected(address.port);
  console.info('[smoke] ok');
} finally {
  relay.close();
  server.close();
}
