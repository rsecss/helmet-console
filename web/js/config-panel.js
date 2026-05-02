/**
 * Connection bar — single URL input + context-sensitive action button.
 * The 5-state ws-client lifecycle is collapsed onto 3 visual states:
 *   disconnected | connecting → 'disconnected' (button: 连接)
 *   connected                 → 'connected'    (button: 断开连接)
 *   reconnecting | error      → 'error'        (button: 重试)
 */

const STORAGE_KEYS = {
  host: 'console.ws.host',
  port: 'console.ws.port',
  path: 'console.ws.path',
  tls: 'console.ws.tls',
  url: 'console.ws.url',
};

function defaultUrl() {
  const tls = window.location.protocol === 'https:';
  const host = window.location.hostname || '127.0.0.1';
  const explicitPort = window.location.port;

  // Explicit port wins (e.g. http://127.0.0.1:8080 during local dev).
  if (explicitPort) {
    return `${tls ? 'wss' : 'ws'}://${host}:${explicitPort}/ws`;
  }

  // No explicit port (reverse-proxied deploys like https://example.com or
  // http://example.com): use the scheme's standard port, otherwise the
  // generated URL would mis-target :8080 behind nginx/CF.
  // Bare local origin still defaults to :8080 for the dev workflow.
  if (!tls && (host === '127.0.0.1' || host === 'localhost')) {
    return `ws://${host}:8080/ws`;
  }
  return `${tls ? 'wss' : 'ws'}://${host}/ws`;
}

function readInitialUrl() {
  const cached = localStorage.getItem(STORAGE_KEYS.url);
  if (cached) return cached;

  const host = localStorage.getItem(STORAGE_KEYS.host);
  const port = localStorage.getItem(STORAGE_KEYS.port);
  const path = localStorage.getItem(STORAGE_KEYS.path) || '/ws';
  const tls = localStorage.getItem(STORAGE_KEYS.tls) === 'true';
  if (host && port) {
    return `${tls ? 'wss' : 'ws'}://${host}:${port}${path.startsWith('/') ? path : '/' + path}`;
  }

  return defaultUrl();
}

function writeConfig({ host, port, path, tls, normalized }) {
  localStorage.setItem(STORAGE_KEYS.host, host);
  localStorage.setItem(STORAGE_KEYS.port, port);
  localStorage.setItem(STORAGE_KEYS.path, path);
  localStorage.setItem(STORAGE_KEYS.tls, String(tls));
  localStorage.setItem(STORAGE_KEYS.url, normalized);
}

export function parseWsUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) {
    return { ok: false, reason: '请输入连接地址' };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return {
      ok: false,
      reason: '无法解析 URL，请使用 ws:// 或 wss:// 开头的完整地址',
    };
  }

  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    return { ok: false, reason: '协议必须是 ws:// 或 wss://' };
  }
  if (!url.hostname) {
    return { ok: false, reason: '主机名不能为空' };
  }

  const tls = url.protocol === 'wss:';
  const port = url.port || (tls ? '443' : '80');
  const path = url.pathname || '/';
  const normalized = `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}${path}`;
  return { ok: true, host: url.hostname, port, path, tls, normalized };
}

const STATE_VIEW = {
  disconnected: {
    pillText: '未连接',
    pillVariant: 'disconnected',
    actionText: '连接',
    actionVariant: 'solid',
    urlReadonly: false,
    actionDisabled: false,
  },
  connecting: {
    pillText: '未连接',
    pillVariant: 'disconnected',
    actionText: '连接',
    actionVariant: 'solid',
    urlReadonly: true,
    actionDisabled: true,
  },
  connected: {
    pillText: '已连接',
    pillVariant: 'connected',
    actionText: '断开连接',
    actionVariant: 'ghost',
    urlReadonly: true,
    actionDisabled: false,
  },
  reconnecting: {
    pillText: '错误',
    pillVariant: 'error',
    actionText: '重试',
    actionVariant: 'solid',
    urlReadonly: false,
    actionDisabled: false,
  },
  error: {
    pillText: '错误',
    pillVariant: 'error',
    actionText: '重试',
    actionVariant: 'solid',
    urlReadonly: false,
    actionDisabled: false,
  },
};

const STATE_TO_DATA_STATE = {
  disconnected: 'disconnected',
  connecting: 'disconnected',
  connected: 'connected',
  reconnecting: 'error',
  error: 'error',
};

export function createConfigPanel({
  shell,
  form,
  urlInput,
  statusPill,
  actionButton,
  inlineError,
  onConnect,
  onDisconnect,
}) {
  let internalState = 'disconnected';

  urlInput.value = readInitialUrl();

  function applyView(state, detail) {
    internalState = state;
    const view = STATE_VIEW[state] || STATE_VIEW.disconnected;
    shell.dataset.state = STATE_TO_DATA_STATE[state] || 'disconnected';

    statusPill.textContent = detail ? `${view.pillText} ${detail}` : view.pillText;
    statusPill.dataset.variant = view.pillVariant;
    actionButton.textContent = view.actionText;
    actionButton.dataset.variant = view.actionVariant;
    actionButton.disabled = view.actionDisabled;

    if (view.urlReadonly) {
      urlInput.setAttribute('readonly', '');
    } else {
      urlInput.removeAttribute('readonly');
    }

    if (state !== 'error' && state !== 'reconnecting') {
      inlineError.textContent = '';
      inlineError.style.display = '';
    }
  }

  function flagInvalid(reason) {
    urlInput.setAttribute('aria-invalid', 'true');
    urlInput.setAttribute('title', reason);
    urlInput.style.animation = 'none';
    void urlInput.offsetWidth;
    urlInput.style.animation = '';
    urlInput.focus();
    inlineError.textContent = reason;
    inlineError.style.display = 'block';
  }

  urlInput.addEventListener('input', () => {
    if (urlInput.hasAttribute('aria-invalid')) {
      urlInput.removeAttribute('aria-invalid');
      urlInput.removeAttribute('title');
      inlineError.textContent = '';
      inlineError.style.display = '';
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (internalState === 'connected') {
      onDisconnect();
      return;
    }

    const parsed = parseWsUrl(urlInput.value);
    if (!parsed.ok) {
      flagInvalid(parsed.reason);
      return;
    }

    urlInput.value = parsed.normalized;
    writeConfig(parsed);
    onConnect(parsed.normalized);
  });

  return {
    setStatus({ name, detail }) {
      applyView(name, detail);
      if (name === 'error' || name === 'reconnecting') {
        const message =
          name === 'reconnecting' ? `连接已断开，正在重试 ${detail || ''}` : detail || '连接失败';
        inlineError.textContent = message.trim();
        inlineError.style.display = 'block';
      }
    },
  };
}
