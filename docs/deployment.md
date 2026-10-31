# Deployment

> Node relay deployment surface — env vars, reverse proxy, smoke checks.
> For the local-first **frp tunnel** orchestration, see
> [frp tunnel setup](frp-tunnel.md).

---

## Requirements

- Node.js 18+
- One TCP port for HTTP and WebSocket

---

## Local

```bash
npm ci
npm start
```

Defaults: `http://127.0.0.1:8080` and `ws://127.0.0.1:8080/ws`.

---

## Environment

| Variable       | Default   | Purpose                                                                |
| -------------- | --------- | ---------------------------------------------------------------------- |
| `HOST`         | `0.0.0.0` | HTTP + WS listen host                                                  |
| `PORT`         | `8080`    | HTTP + WS listen port                                                  |
| `WS_PATH`      | `/ws`     | WebSocket endpoint                                                     |
| `STATIC_DIR`   | `web/`    | Default under the project root; overrides resolve from `process.cwd()` |
| `MAX_CLIENTS`  | `32`      | Max concurrent WS clients                                              |
| `HEARTBEAT_MS` | `30000`   | Frontend heartbeat reference                                           |
| `LOG_LEVEL`    | `info`    | Reserved for future tuning                                             |

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
npm test            # lint + unit tests + smoke
npm run format:check
```

The smoke script starts an ephemeral server, verifies `/healthz`, opens
two WebSocket clients, and asserts broadcast from one to the other plus
ping/pong and binary-frame close.

---

## Tunnel + Public Ingress

For exposing the local relay over a public domain through frp and a reverse proxy,
see [frp tunnel setup](frp-tunnel.md). It requires you to
provide your own VPS, frps token, and domain.

## Capturing Logs

The server and launcher write to the terminal; they do not create log files.
For an explicit capture, create root `logs/` and redirect output there:

```bash
mkdir -p logs
npm start > logs/server.log 2>&1
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force logs | Out-Null
npm start *> logs/server.log
```

Use separate filenames for simultaneous processes. Root `logs/` and `*.log`
are ignored; no placeholder file is needed. Existing root-level logs can stay
local, but new captures belong in `logs/`. Do not move or truncate files while
a process is writing to them. Before sharing diagnostic excerpts, remove
credentials and device data. Public log retention is not part of this repository.
