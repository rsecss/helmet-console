const STORAGE_KEYS = {
  host: 'console.ws.host',
  port: 'console.ws.port',
  path: 'console.ws.path',
  tls: 'console.ws.tls',
};

const DEFAULT_CONFIG = {
  host: window.location.hostname || '127.0.0.1',
  port: window.location.port || '8080',
  path: '/ws',
  tls: window.location.protocol === 'https:',
};

function readConfig() {
  return {
    host: localStorage.getItem(STORAGE_KEYS.host) || DEFAULT_CONFIG.host,
    port: localStorage.getItem(STORAGE_KEYS.port) || DEFAULT_CONFIG.port,
    path: localStorage.getItem(STORAGE_KEYS.path) || DEFAULT_CONFIG.path,
    tls: localStorage.getItem(STORAGE_KEYS.tls) === 'true' || DEFAULT_CONFIG.tls,
  };
}

function writeConfig(config) {
  localStorage.setItem(STORAGE_KEYS.host, config.host);
  localStorage.setItem(STORAGE_KEYS.port, config.port);
  localStorage.setItem(STORAGE_KEYS.path, config.path);
  localStorage.setItem(STORAGE_KEYS.tls, String(config.tls));
}

function buildUrl(config) {
  const protocol = config.tls ? 'wss' : 'ws';
  const path = config.path.startsWith('/') ? config.path : `/${config.path}`;
  return `${protocol}://${config.host}:${config.port}${path}`;
}

export function createConfigPanel({
  form,
  hostInput,
  portInput,
  pathInput,
  tlsInput,
  connectButton,
  disconnectButton,
  onConnect,
  onDisconnect,
}) {
  const initial = readConfig();

  hostInput.value = initial.host;
  portInput.value = initial.port;
  pathInput.value = initial.path;
  tlsInput.checked = initial.tls;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const config = {
      host: hostInput.value.trim(),
      port: portInput.value.trim(),
      path: pathInput.value.trim() || '/ws',
      tls: tlsInput.checked,
    };

    writeConfig(config);
    onConnect(buildUrl(config));
  });

  disconnectButton.addEventListener('click', () => {
    onDisconnect();
  });

  return {
    setConnected(connected) {
      connectButton.disabled = connected;
      disconnectButton.disabled = !connected;
    },
  };
}
