# Backend Spec Index

The backend is a single-process **Node.js (ESM, Node 18+)** host server:
it serves `web/` over HTTP and relays WebSocket frames between clients
on `/ws`. It must never become an application framework or a data-storage
layer. See `docs/architecture.md` §1 for system context.

---

## Pre-Development Checklist

Before touching `server/`:
1. [`quality-guidelines.md`](./quality-guidelines.md) — HTTP/WS contracts, signatures, validation matrix
2. `docs/architecture.md` §2 + §4 — module diagram and WS protocol
3. `docs/interface.md` — detailed HTTP/WS interface

Before touching `deploy/`:
1. [`operational-scripts.md`](./operational-scripts.md) — port sync, subprocess output, secrets
2. `deploy/deploy.md` — current topology, prerequisites, setup

---

## Index

| Guide                                              | Status            |
| -------------------------------------------------- | ----------------- |
| [Quality Guidelines](./quality-guidelines.md)      | Filled            |
| [Directory Structure](./directory-structure.md)    | Filled            |
| [Error Handling](./error-handling.md)              | Filled            |
| [Logging Guidelines](./logging-guidelines.md)      | Filled            |
| [Operational Scripts](./operational-scripts.md)    | Filled            |
| [Database Guidelines](./database-guidelines.md)    | Not Applicable    |

> "Not Applicable" means the topic does not apply to the project's
> forward-only relay design. Revisit only if the PRD adds persistence
> (see `docs/architecture.md` §9).

---

**Language**: All documentation is written in English.
