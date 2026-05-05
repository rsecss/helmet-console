import http from 'node:http';

import { config } from './config.js';
import { createStaticHandler } from './static.js';
import { createWsRelay } from './ws-relay.js';

const relay = createWsRelay(config);
const handleRequest = createStaticHandler({
  staticDir: config.staticDir,
  getClientCount: relay.getClientCount,
});

const server = http.createServer(handleRequest);

server.on('upgrade', relay.handleUpgrade);
server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(config.port, config.host, () => {
  console.info(`[server] listening on http://${config.host}:${config.port}`);
  console.info(`[server] websocket path ${config.wsPath}`);
});

function shutdown(signal) {
  console.info(`[server] ${signal} received, shutting down`);
  relay.close();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
