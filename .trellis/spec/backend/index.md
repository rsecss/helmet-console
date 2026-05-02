# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

The backend is a single-process **Node.js (ESM, Node 18+)** host server: it
serves `web/` over HTTP and relays WebSocket frames between clients on
`/ws`. It must not become an application framework or a data-storage layer.
See `docs/architecture.md` §1 for the system context.

---

## Pre-Development Checklist

Before touching `server/`, read:

1. **`quality-guidelines.md`** — full HTTP / WS contract, signatures,
   validation matrix, design decisions
2. **`docs/architecture.md` §2 + §4** — module diagram and WS protocol
3. **`docs/interface.md`** — detailed HTTP / WS interface

Before touching `deploy/`, read:

1. **`operational-scripts.md`** — relay-port sync, subprocess output,
   secrets/binaries gitignore
2. **`deploy/deploy.md`** — current topology, prerequisites, setup steps,
   pending operational followups

---

## Quality Check

Before declaring backend work done, verify against
`quality-guidelines.md` Code Review Checklist:

- `server/src/index.js` is composition-only (no routing logic, no frame parsing)
- `/healthz` reports `clients` via `relay.getClientCount()`
- `ws-relay.js` validates **envelope fields only** — never branches on `payload`
- New env vars are documented in `quality-guidelines.md` **and** `docs/deployment.md`
- `server/scripts/smoke.js` covers the changed contract
- `npm test` (lint + smoke) and `npm run format:check` pass
- No `console.log` (use `console.info` / `warn` / `error`)
- No new web framework, no DB driver, no in-memory frame buffer
- Relay port changes touched all three sites: `config.js`, `start.py`, `frpc.toml` (+ example template)
- `deploy/start.py` subprocesses inherit stdout/stderr (no `DEVNULL`)
- New deploy secrets/binaries are listed in `.gitignore` before first commit

---

## Guidelines Index

| Guide                                              | Description                                                | Status            |
| -------------------------------------------------- | ---------------------------------------------------------- | ----------------- |
| [Quality Guidelines](./quality-guidelines.md)      | HTTP / WS contracts, signatures, validation matrix         | **Filled**        |
| [Directory Structure](./directory-structure.md)    | Module organization (`server/src/`, `server/scripts/`)     | **Filled**        |
| [Error Handling](./error-handling.md)              | `BAD_FRAME` envelope, HTTP errors, shutdown                | **Filled**        |
| [Logging Guidelines](./logging-guidelines.md)      | `console.info/warn/error`, scope tags, what NOT to log     | **Filled**        |
| [Operational Scripts](./operational-scripts.md)    | `deploy/` port sync, subprocess output, secrets/binaries   | **Filled**        |
| [Database Guidelines](./database-guidelines.md)    | —                                                          | **Not Applicable**|

> "Not Applicable" means the topic does not apply to this project's current
> design (forward-only relay, no persistence). Revisit only if the PRD adds
> persistence (see `docs/architecture.md` §9 deferred extensions).

---

**Language**: All documentation should be written in **English**.
