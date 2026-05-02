# Helmet Console

Lightweight host-side terminal console for embedded devices. A single Node.js
process serves the browser UI and relays WebSocket frames between browsers and
devices.

## Directory Structure

```text
helmet-console/
├── deploy/
│   ├── deploy.md
│   ├── frpc.example.toml
│   └── start.py
├── server/
│   ├── scripts/
│   │   └── smoke.js
│   └── src/
│       ├── config.js
│       ├── index.js
│       ├── static.js
│       └── ws-relay.js
├── web/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── command-panel.js
│   │   ├── config-panel.js
│   │   ├── control-panel.js
│   │   ├── main.js
│   │   ├── terminal.js
│   │   └── ws-client.js
│   ├── vendor/
│   │   └── xterm/
│   └── index.html
└── docs/
    ├── architecture.md
    ├── contributing.md
    ├── deployment.md
    ├── design/
    │   ├── prototype-rose.html
    │   ├── prototype.html
    │   └── stitch-prompt-vue-calibrated.md
    └── interface.md
```

`server/` and `web/` are separated by runtime boundary: Node.js owns HTTP/WS,
the browser owns UI state and terminal rendering. The browser UI follows a
serial-assistant model: the terminal displays received data and logs, while
commands are sent from the command input panel.

## Quick Start

```bash
npm install
npm start                    # local relay only
```

For the local-first frp tunnel deployment (Node relay + frpc, exposing the
console over a public domain):

```bash
python deploy/start.py       # see deploy/deploy.md for prerequisites
```

Open `http://127.0.0.1:8080`.

## Checks

```bash
npm run lint
npm test
npm run format:check
npm run smoke
```

## Docs

- `deploy/deploy.md` — local-first frp tunnel setup (BYO domain/VPS/token)
- `docs/architecture.md` — system shape and module boundaries
- `docs/interface.md` — HTTP and WebSocket contracts
- `docs/deployment.md` — local and service deployment notes (Node relay env vars + reverse proxy)
- `docs/design/prototype-rose.html` — current interactive prototype (rose theme); the
  `web/` UI is a 1:1 replica of this file
- `docs/design/prototype.html` — earlier green prototype (kept for reference only)
