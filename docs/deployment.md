# Deployment

> Node relay deployment surface — env vars, reverse proxy, smoke checks.
> For the local-first **frp tunnel** orchestration, see
> [`../deploy/deploy.md`](../deploy/deploy.md).

---

## Requirements

- Node.js 18+
- One TCP port for HTTP and WebSocket

---

## Local

```bash
npm install
npm start
```

Defaults: `http://127.0.0.1:8080` and `ws://127.0.0.1:8080/ws`.

---

## Environment

| Variable       | Default   | Purpose                                         |
| -------------- | --------- | ----------------------------------------------- |
| `HOST`         | `0.0.0.0` | HTTP + WS listen host                           |
| `PORT`         | `8080`    | HTTP + WS listen port                           |
| `WS_PATH`      | `/ws`     | WebSocket endpoint                              |
| `STATIC_DIR`   | `web/`    | Static file root, resolved from `process.cwd()` |
| `MAX_CLIENTS`  | `32`      | Max concurrent WS clients                       |
| `HEARTBEAT_MS` | `30000`   | Frontend heartbeat reference                    |
| `LOG_LEVEL`    | `info`    | Reserved for future tuning                      |

```bash
PORT=9000 WS_PATH=/ws node server/src/index.js
```

PowerShell:

```powershell
$env:PORT = '9000'; $env:WS_PATH = '/ws'; npm start
```

---

## Reverse Proxy

```nginx
location / {
  proxy_pass http://127.0.0.1:8080;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

TLS terminates at the proxy unless the project later needs direct
Node.js HTTPS.

---

## Smoke Checks

```bash
npm test            # lint + smoke
npm run format:check
```

The smoke script starts an ephemeral server, verifies `/healthz`, opens
two WebSocket clients, and asserts broadcast from one to the other plus
ping/pong and binary-frame close.

---

## Tunnel + Public Ingress

For exposing the local relay over a public domain (frp + nginx + CF),
see [`../deploy/deploy.md`](../deploy/deploy.md). It requires you to
provide your own VPS, frps token, and domain.
