import http from 'node:http';

import WebSocket from 'ws';

import { config } from '../src/config.js';
import { createStaticHandler } from '../src/static.js';
import { createWsRelay } from '../src/ws-relay.js';

const relay = createWsRelay({ ...config, maxClients: 2 });
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

async function verifyBroadcast(port) {
  const sender = await openSocket(port);
  const receiver = await openSocket(port);

  try {
    const received = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for broadcast frame'));
      }, 1000);

      receiver.once('message', (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString('utf8')));
      });
    });

    sender.send(JSON.stringify({ from: 'web', type: 'data', payload: 'hello' }));

    const frame = await received;
    if (frame.from !== 'web' || frame.type !== 'data' || frame.payload !== 'hello') {
      throw new Error(`Unexpected broadcast frame: ${JSON.stringify(frame)}`);
    }
  } finally {
    sender.close();
    receiver.close();
  }
}

try {
  const address = await listen();
  await requestHealth(address.port);
  await verifyBroadcast(address.port);
  console.info('[smoke] ok');
} finally {
  relay.close();
  server.close();
}
