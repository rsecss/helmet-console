# Frontend Spec Index

The console is a native browser ESM app under `web/` with no build tool.
Visual surface mirrors `docs/design/prototype-rose.html` 1:1.

---

## Pre-Development Checklist

Before touching `web/`:
1. [`quality-guidelines.md`](./quality-guidelines.md) — hard constraints, module ownership, signatures, validation matrix, design decisions
2. `docs/design/prototype-rose.html` — visual surface of truth (gitignored prototype)
3. `docs/architecture.md` §2 + §5 — module diagram and connection state machine

---

## Index

| Guide                                              | Status     |
| -------------------------------------------------- | ---------- |
| [Quality Guidelines](./quality-guidelines.md)      | Filled     |
| [Directory Structure](./directory-structure.md)    | Filled     |
| [State Management](./state-management.md)          | Filled     |
| [Type Safety](./type-safety.md)                    | Filled     |
| [Component Guidelines](./component-guidelines.md)  | Deferred   |
| [Hook Guidelines](./hook-guidelines.md)            | Deferred   |

> "Deferred" means the topic does not apply to the current stack
> (native ESM, no framework, no hooks). Revisit only if the stack changes.

---

**Language**: All documentation is written in English.
