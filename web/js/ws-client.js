const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];
const HEARTBEAT_MS = 30000;
const STALE_MS = 45000;
const PING_FRAME = 'ping\n';

export function createWsClient({ onStatus, onFrame, onLog }) {
  let socket = null;
  let url = '';
  let closedByUser = false;
  let reconnectAttempt = 0;
  let reconnectTimer = 0;
  let heartbeatTimer = 0;
  let staleTimer = 0;

  function setStatus(name, detail = '') {
    onStatus({ name, detail });
  }

  function clearTimers() {
    window.clearTimeout(reconnectTimer);
    window.clearInterval(heartbeatTimer);
    window.clearInterval(staleTimer);
  }

  function send(text) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      onLog('[ws] not connected');
      return false;
    }

    socket.send(text);
    return true;
  }

  function markActivity() {
    lastActivity = Date.now();
  }

  let lastActivity = Date.now();

  function startHeartbeat() {
    window.clearInterval(heartbeatTimer);
    window.clearInterval(staleTimer);
    markActivity();

    heartbeatTimer = window.setInterval(() => {
      send(PING_FRAME);
    }, HEARTBEAT_MS);

    staleTimer = window.setInterval(() => {
      if (Date.now() - lastActivity > STALE_MS && socket) {
        socket.close();
      }
    }, 1000);
  }

  function scheduleReconnect() {
    if (closedByUser || reconnectAttempt >= RECONNECT_DELAYS.length) {
      setStatus('error', '连接已断开');
      return;
    }

    const delay = RECONNECT_DELAYS[reconnectAttempt];
    reconnectAttempt += 1;
    setStatus('reconnecting', `${reconnectAttempt}/${RECONNECT_DELAYS.length}`);

    reconnectTimer = window.setTimeout(() => {
      connect(url);
    }, delay);
  }

  function connect(nextUrl) {
    url = nextUrl;
    closedByUser = false;
    clearTimers();
    setStatus('connecting');

    const activeSocket = new WebSocket(url);
    socket = activeSocket;

    activeSocket.addEventListener('open', () => {
      if (socket !== activeSocket) {
        activeSocket.close(1000, 'stale connection');
        return;
      }
      reconnectAttempt = 0;
      setStatus('connected');
      startHeartbeat();
    });

    activeSocket.addEventListener('message', (event) => {
      if (socket !== activeSocket) return;
      markActivity();

      if (typeof event.data !== 'string') {
        onLog('[ws] dropped binary frame');
        return;
      }

      onFrame(event.data);
    });

    activeSocket.addEventListener('close', (event) => {
      if (socket !== activeSocket) return;
      clearTimers();
      socket = null;

      if (closedByUser || event.code === 1000) {
        setStatus('disconnected');
        return;
      }

      scheduleReconnect();
    });

    activeSocket.addEventListener('error', () => {
      if (socket !== activeSocket) return;
      onLog('[ws] error');
    });
  }

  function disconnect() {
    closedByUser = true;
    clearTimers();

    if (socket) {
      socket.close(1000, 'user disconnect');
      socket = null;
    }

    setStatus('disconnected');
  }

  return {
    connect,
    disconnect,
    send,
    isConnected() {
      return Boolean(socket && socket.readyState === WebSocket.OPEN);
    },
  };
}
