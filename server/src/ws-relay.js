import WebSocket, { WebSocketServer } from 'ws';

const PING_FRAME = 'ping';
const PONG_FRAME = 'pong\n';

export function createWsRelay({ wsPath, maxClients, logger = console }) {
  const wss = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    maxPayload: 1024 * 1024,
    perMessageDeflate: false,
  });

  function broadcast(sender, text) {
    for (const client of wss.clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(text);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.on('error', (error) => {
      logger.warn('[ws] client error', error.message);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        ws.close(1003, 'binary frames are not supported');
        return;
      }

      const text = data.toString('utf8');

      if (text.replace(/\r?\n$/, '') === PING_FRAME) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(PONG_FRAME);
        }
        return;
      }

      broadcast(ws, text);
    });
  });

  function handleUpgrade(req, socket, head) {
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname !== wsPath) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    if (wss.clients.size >= maxClients) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  }

  return {
    handleUpgrade,
    getClientCount: () => wss.clients.size,
    close: () => wss.close(),
  };
}
