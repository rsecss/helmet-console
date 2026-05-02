# Operational Scripts

> Conventions for `deploy/` — local-first orchestration of Relay + frpc tunnel.

---

## Overview

`deploy/` orchestrates the Helmet Console for local-first operation:

- `deploy/start.py` — one-shot launcher: clears `:8080`, starts `npm start`,
  waits for the port, starts `frpc`, supervises both
- `deploy/frpc.toml` — real frp client config (gitignored, contains token)
- `deploy/frpc.example.toml` — committed template for new contributors
- `deploy/frpc.exe` / `deploy/frpc` — frp binary (gitignored, not bundled)

Operational adjuncts to the backend service. Keep small and direct;
project-state values (current domain, VPS IP, token) belong in
`deploy/deploy.md`, not in this spec.

---

## Forbidden Patterns

- Do not redirect long-running child stdout/stderr to `DEVNULL` in
  `deploy/start.py`. Token, network, and upstream-unreachable failures
  must remain visible inline.
- Do not commit `deploy/frpc.toml` or any frp binary. Both belong in
  `.gitignore`; only the example template is tracked.
- Do not reference the relay port as a literal in only one of the three
  call sites. The port is a synced constant — see scenario below.
- Do not bake current domain / VPS / token values into `spec/`.
  Those are project state, not coding rules. Document them in
  `deploy/deploy.md` and reference them from a `# TODO` in `start.py`.

---

## Required Patterns

### Scenario: Three-Place Relay Port Constant

#### 1. Scope / Trigger

Any change to the Node relay listen port. The default `8080` is referenced
in three files that must agree; otherwise `frpc` forwards to a port no one
listens on, the tunnel reports green, and the public URL silently 502s.

#### 2. Signatures

```
server/src/config.js     readNumber('PORT', 8080)   // source of truth
deploy/start.py          RELAY_PORT = 8080          // mirror
deploy/frpc.toml         localPort = 8080           // mirror (real)
deploy/frpc.example.toml localPort = 8080           // mirror (template)
```

#### 3. Contracts

- `server/src/config.js#PORT` default is the source of truth.
- `deploy/start.py#RELAY_PORT` must equal it (the launcher waits on this
  port; mismatch hangs `wait_for_port`).
- `deploy/frpc.toml#localPort` must equal it (frpc forwards remote
  traffic to it).
- The example template carries the same default for new clones.

#### 4. Validation & Error Matrix

| State                                  | Result                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `frpc.toml#localPort` ≠ server port    | Tunnel green; `/healthz` over public URL returns connection refused upstream |
| `start.py#RELAY_PORT` ≠ server port    | `wait_for_port` times out; launcher reports relay startup failure even though `npm start` succeeded |

#### 5. Good / Base / Bad

- **Good**: changing port from `8080` to `8081`, run
  `grep -rn '8080' server/ deploy/`, update all hits in one commit.
- **Bad**: editing only `config.js` — launcher waits on `:8080`, server
  listens on `:8081`, user sees a misleading "Relay 启动超时".

#### 6. Tests Required

- `python deploy/start.py` prints `[server] listening on http://0.0.0.0:<port>`
  followed by `[frpc] 隧道已建立 ✓`.
- `curl http://localhost:<port>/healthz` returns 200.
- `curl https://<public-host>/healthz` returns 200 when the tunnel is up.

#### 7. Wrong vs Correct

**Wrong**:

```
# server/src/config.js
port: readNumber('PORT', 8081)

# deploy/start.py
RELAY_PORT = 8080            # stale

# deploy/frpc.toml
localPort = 8080             # stale
```

**Correct**: all three files use `8081`.

---

### Scenario: Subprocess Output Visibility

#### 1. Scope / Trigger

Any `subprocess.Popen` in `deploy/start.py` for `npm start`, `frpc`, or
future long-running helpers.

#### 2. Contracts

- Long-running subprocesses inherit the launcher's stdout/stderr.
- `[server]` and `[frpc]` lines must appear in real time in the parent
  terminal so token mismatches, port conflicts, and `login to server failed`
  surface without extra log files.

#### 4. Validation & Error Matrix

| State                                  | Result                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `Popen(stdout=DEVNULL)` on `frpc`      | Auth/connection errors silent; user only sees "隧道已建立 ✓" or eventual reconnect cycle |
| `Popen(stdout=DEVNULL)` on `npm start` | Server crashes silently; `wait_for_port` is the sole signal, masking the real cause |

#### 5. Good / Base / Bad

- **Good**: wrong `auth.token` → user sees
  `login to server failed: token is incorrect` immediately.
- **Bad**: same scenario with `DEVNULL` → user sees only "frpc 启动失败" with no reason.

#### 7. Wrong vs Correct

**Wrong**:

```python
proc = subprocess.Popen(
    [npm_bin, "start"],
    cwd=str(PROJECT_ROOT),
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
```

**Correct**:

```python
proc = subprocess.Popen(
    [npm_bin, "start"],
    cwd=str(PROJECT_ROOT),
)
```

---

### Scenario: Secrets and Binaries Stay Out of Git

#### 1. Scope / Trigger

Any new file under `deploy/` carrying tokens, server addresses, or
runtime binaries.

#### 3. Contracts

| File                       | Tracked? | Reason                                                |
| -------------------------- | -------- | ----------------------------------------------------- |
| `deploy/start.py`          | yes      | Public URLs only; current values are non-sensitive    |
| `deploy/frpc.toml`         | **no**   | Contains `auth.token` and server IP                   |
| `deploy/frpc.example.toml` | yes      | Template with `YOUR_SERVER_IP` / `YOUR_TOKEN`         |
| `deploy/frpc.exe`          | **no**   | Third-party binary, downloaded per-host               |
| `deploy/frpc`              | **no**   | Same on macOS/Linux                                   |

`.gitignore` must list every "no" row by exact path.

#### 5. Good / Base / Bad

- **Good**: contributor runs
  `cp deploy/frpc.example.toml deploy/frpc.toml`, fills in real values;
  `git status` shows no changes under `deploy/`.
- **Bad**: a real `frpc.toml` accidentally committed once → token must
  be rotated and history rewritten (BFG / `git filter-repo`).

#### 6. Tests Required

- `git check-ignore deploy/frpc.toml deploy/frpc.exe` exits 0 for both.
- `grep -E 'token|YOUR_' deploy/frpc.example.toml` shows only `YOUR_*`
  placeholders.

#### 7. Wrong vs Correct

**Wrong** (`.gitignore` only covers the config):

```
deploy/frpc.toml
```

**Correct**:

```
deploy/frpc.toml
deploy/frpc.exe
deploy/frpc
```

---

## Code Review Checklist

- Did a relay port change update `config.js`, `start.py#RELAY_PORT`, and
  both `frpc.toml` files (real + example)?
- Are all `subprocess.Popen` calls in `deploy/start.py` inheriting
  stdout/stderr (no `DEVNULL`)?
- Are new secret-bearing or binary files under `deploy/` listed in
  `.gitignore`?
- Does `frpc.example.toml` carry only `YOUR_*` placeholders (no real
  IP/token)?
- Are temporary domain / VPS / token values documented in
  `deploy/deploy.md` (not in `spec/`)?

---

**Language**: All documentation should be written in **English**.
