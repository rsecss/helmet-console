import WebSocket, { WebSocketServer } from 'ws';

const VALID_TYPES = new Set(['data', 'cmd', 'status', 'error', 'ping', 'pong']);

function sendFrame(ws, frame) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(frame));
  }
}

function sendError(ws, code, message) {
  sendFrame(ws, {
    from: 'server',
    type: 'error',
    payload: { code, message },
    ts: Date.now(),
  });
}

function parseFrame(data) {
  try {
    const frame = JSON.parse(data.toString('utf8'));
    return { frame };
  } catch {
    return { error: 'Frame must be UTF-8 JSON text' };
  }
}

function validateFrame(frame) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
    return 'Frame must be a JSON object';
  }

  if (typeof frame.from !== 'string' || frame.from.length === 0) {
    return 'Frame field "from" must be a non-empty string';
  }

  if (typeof frame.type !== 'string' || !VALID_TYPES.has(frame.type)) {
    return 'Frame field "type" is unsupported';
  }

  if (!Object.hasOwn(frame, 'payload')) {
    return 'Frame field "payload" is required';
  }

  return null;
}

function normalizeFrame(frame) {
  return {
    from: frame.from,
    type: frame.type,
    payload: frame.payload,
    ts: Number.isFinite(frame.ts) ? frame.ts : Date.now(),
  };
}

export function createWsRelay({ wsPath, maxClients, logger = console }) {
  const wss = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    maxPayload: 1024 * 1024,
    perMessageDeflate: false,
  });

  function broadcast(sender, frame) {
    const payload = JSON.stringify(frame);

    for (const client of wss.clients) {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.on('error', (error) => {
      logger.warn('[ws] client error', error.message);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        sendError(ws, 'BAD_FRAME', 'Binary frames are not supported');
        return;
      }

      const { frame, error } = parseFrame(data);
      if (error) {
        sendError(ws, 'BAD_FRAME', error);
        return;
      }

      const validationError = validateFrame(frame);
      if (validationError) {
        sendError(ws, 'BAD_FRAME', validationError);
        return;
      }

      if (frame.type === 'ping') {
        sendFrame(ws, {
          from: 'server',
          type: 'pong',
          payload: null,
          ts: Date.now(),
        });
        return;
      }

      broadcast(ws, normalizeFrame(frame));
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
