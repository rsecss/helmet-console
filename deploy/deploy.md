# Helmet Console Deployment

> Local-first deployment via frp tunnel. Bring up `npm start` + `frpc` with
> one command. Coding rules live in
> `.trellis/spec/backend/operational-scripts.md`; this file tracks current
> operational state and the end-to-end setup flow.

---

## ⚠️ Heads-Up — These Are Personal Test Values, Not a Drop-In Template

Every domain / IP / port / token in this document is what **the maintainer
tested with on 2026-05-03**. They are recorded so anyone reading the
source can match strings in `deploy/start.py` / `deploy/frpc.toml` to
their meaning — **not** as a working configuration you can clone.

**You must self-provide every row in [Current Test Environment](#current-test-environment-bring-your-own).**

If you only need the Node relay locally (no public ingress), you can skip
the entire tunnel layer:

```bash
python deploy/start.py --local
```

---

## What You Need to Provide (BYO)

Before deploying with the tunnel, gather your own:

- [ ] **VPS** with a public IP and the chosen frps ports reachable
      (default `7000` for frps server, plus your tunnel port).
- [ ] **frps** running on that VPS with a strong token
      (`openssl rand -hex 32` recommended).
- [ ] **Public domain** with DNS pointing at the VPS
      (Cloudflare orange-cloud is OK for wss).
- [ ] **nginx** terminating TLS on `:443` and `proxy_pass` to
      `127.0.0.1:<your-tunnel-port>` for the public domain, with
      WebSocket upgrade headers (`Upgrade` / `Connection: upgrade`).
- [ ] **frpc client binary** for your local OS, dropped into `deploy/`
      (see [On-host prerequisites](#on-host-local)).
- [ ] **Node.js 18+** and **Python 3.8+** locally.

Everything below assumes you have the above. Without them, only `--local`
mode works.

---

## Current Test Environment (Bring Your Own)

> 🚨 **Replace every value below with your own before deploying.** They
> are documented so any hardcoded string in the codebase can be traced
> back to its meaning, not as a configuration you can adopt as-is.

| Item             | Maintainer's test value (replace with yours) | Where it appears / notes                             |
| ---------------- | -------------------------------------------- | ---------------------------------------------------- |
| Public domain    | `websocket.vaple.cc`                         | `vaple.cc` is a personal dev domain; not portable    |
| VPS IP           | `45.205.25.184` (overseas)                   | Personal VPS                                         |
| frps server port | `7000`                                       | frps own listener (default)                          |
| frps tunnel port | `13000`                                      | TCP exposed; nginx 443 proxies to it; devices direct |
| frps token       | rotation pending (R5)                        | Original maintainer token leaked → **must rotate**   |
| frps Dashboard   | rotation pending (R5)                        | Weak password until rotated                          |
| Local relay port | `8080`                                       | Source of truth: `server/src/config.js#PORT`         |

To find every place to edit when you swap in your own values:

```bash
grep -rn 'websocket.vaple.cc\|45.205.25.184' .
```

Today's hits: `deploy/start.py` (PUBLIC\_\*\_URL constants),
`deploy/frpc.toml` (your local copy after `cp` from the example), and
this doc.

The **local relay port** (`8080`) is project-internal — keep it unless
you have a real port conflict; if you change it, see the
[Three-Place Relay Port Constant](#operational-rules--where-they-live)
rule for the three sites that must update together.

---

## Topology (with maintainer's values; substitute yours)

```
[Browser]  ── wss://<your-domain>/ws ──→ Cloudflare ──→ VPS nginx:443
                                                            │ proxy_pass
                                                            ▼
                                                       VPS frps:<tunnel-port>
                                                            │ frp tunnel
                                                            ▼
                                                       local frpc → :8080 Node

[Device]   ── ws://<your-vps-ip>:<tunnel-port>/ws ────→ direct VPS (bypasses CF)
                                                            │
                                                            ▼
                                                       frps → frpc → :8080
```

Browser and device hit different ingresses but share the same Node
process. This is a development-time deployment — see
[Production Path](#production-path) for how to harden it.

---

## Prerequisites

### Off-host (your VPS)

- VPS reachable on the public internet.
- frps running with token + your chosen tunnel port (maintainer used
  `13000`).
- Cloudflare DNS pointing the public domain at the VPS (orange-cloud OK
  for wss).
- nginx terminating TLS on `:443` and `proxy_pass` to
  `127.0.0.1:<your-tunnel-port>` for the public domain, with
  WebSocket upgrade headers.

### On-host (local)

- Node.js 18+ (`npm` is shelled out from `start.py`).
- Python 3.8+.
- frp client binary placed under `deploy/`:
  - Windows: `deploy/frpc.exe`
  - macOS / Linux: `deploy/frpc`
  - Download from <https://github.com/fatedier/frp/releases>; binaries
    are **not** committed.

---

## Setup

```bash
# 1. Copy the example config and fill in YOUR real values
cp deploy/frpc.example.toml deploy/frpc.toml

# 2. Edit deploy/frpc.toml — replace YOUR_SERVER_IP / YOUR_TOKEN
#    Also edit deploy/start.py PUBLIC_*_URL constants if you've swapped
#    the public domain or VPS IP from the maintainer's test values.

# 3. Place the frpc binary under deploy/
#    Windows:   deploy/frpc.exe
#    Unix-like: deploy/frpc

# 4. Launch
python deploy/start.py
# Use --local to skip frpc and run only the Node relay
```

The launcher does, in order:

1. Frees `:8080` if occupied (Windows `taskkill` / Unix `fuser`).
2. Starts `npm start` and waits for `:8080` (timeout 20s).
3. Starts `frpc -c frpc.toml`.
4. Supervises both — restarts the relay on exit; reconnects frpc after
   5s on drop.

`Ctrl+C` stops both cleanly via `SIGINT`/`SIGTERM` handlers.

---

## Verification (replace URLs with yours)

```bash
# Local relay healthcheck
curl http://localhost:8080/healthz
# → { "status": "ok", "uptime": ..., "clients": 0 }

# Through the tunnel + Cloudflare
curl -I https://<your-domain>/healthz
# → HTTP/2 200

# Browser
# Open https://<your-domain>/  — connect button turns the pill green;
# the URL field defaults to wss://<your-domain>/ws (no :8080 fallback).

# Device direct path (bypasses CF; cleartext OK for dev)
# Connect a sim-device to ws://<your-vps-ip>:<tunnel-port>/ws — frames
# forward to all browser clients on the same Node process.
```

---

## Operational Rules → Where They Live

| Topic                     | Spec section                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Three-place port constant | `.trellis/spec/backend/operational-scripts.md` § "Three-Place Relay Port Constant"      |
| Subprocess visibility     | `.trellis/spec/backend/operational-scripts.md` § "Subprocess Output Visibility"         |
| Secrets and binaries      | `.trellis/spec/backend/operational-scripts.md` § "Secrets and Binaries Stay Out of Git" |

Quick-reference summary (skim before making deploy changes):

- The relay port `8080` lives in `server/src/config.js`,
  `deploy/start.py`, and `deploy/frpc.toml` — they must agree.
- Never silence subprocess stdout/stderr in `start.py` — token errors
  and connection failures must surface inline.
- `deploy/frpc.toml` and `deploy/frpc[.exe]` are gitignored. Only
  `frpc.example.toml` is tracked.

---

## Production Path

Today's setup is dev-only:

- Browser uses CF/wss (good).
- Device uses direct cleartext on the tunnel port (acceptable since
  payload is non-sensitive during development).

To productize:

1. Confirm the device modem firmware supports wss.
2. Switch device firmware to `wss://<production-domain>/ws`.
3. Close the tunnel port's external exposure on the VPS firewall
   (CF + nginx becomes the only ingress).
4. Replace the maintainer's test domain/IP with your production values
   (search the repo).
5. Move from manual `python start.py` to a process supervisor
   (systemd / pm2) on the local host.

The tunnel architecture stays — only the device ingress and supervision
change.

---

## Pending Followups (R5 from `05-03-console-tunnel-bringup`)

These apply to the maintainer's own dev environment. If you've followed
[BYO](#what-you-need-to-provide-byo) with your own VPS/token from the
start, only the structural items (#4, #5) are likely relevant.

- [ ] Rotate frps token to `openssl rand -hex 32` value on VPS + local
      `frpc.toml`.
- [ ] Rotate frps Dashboard password (currently weak).
- [ ] Decide on git history scrub if repo is or becomes public
      (BFG / `git-filter-repo`).
- [ ] frps systemd unit with `Restart=always`.
- [ ] Local Relay restart with exponential backoff (`start.py` currently
      respawns immediately).

Detail:
`.trellis/tasks/archive/2026-05/05-03-console-tunnel-bringup/prd.md`
§ "Pending Followups (R5 — 测试通过后启动新 task)".

---

## References

- Coding rules for `deploy/`:
  `.trellis/spec/backend/operational-scripts.md`
- Architecture (system context): `docs/architecture.md` (gitignored,
  local-only)
- Cross-layer constants checklist:
  `.trellis/spec/guides/cross-layer-thinking-guide.md`
- Archived bring-up task:
  `.trellis/tasks/archive/2026-05/05-03-console-tunnel-bringup/`
