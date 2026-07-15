# Contributing

Helmet Console aims to stay a **lightweight** WebSocket relay. Changes
follow KISS — no complexity unrelated to the goal.

---

## Setup

```bash
npm install            # one-time; installs dev deps + git hooks
npm test               # ESLint + smoke
npm run format:check   # Prettier check
```

`npm install` runs `prepare` → `simple-git-hooks` writes `commit-msg`
into `.git/hooks/`. No husky.

---

## Branching: GitHub Flow

```
main                          ← protected; always releasable
└── feat/<scope>-<desc>       ← features
└── fix/<scope>-<desc>        ← bugfixes
└── docs/<scope>              ← docs-only
└── chore/<scope>             ← tooling / chores
```

- Single trunk: short-lived branches merge into `main` via PR.
- Trivial docs/chore changes may be pushed to `main` directly by
  maintainers; anything touching `server/` or `web/` goes through a PR.
- Releases are cut from `main` with a tag (`vX.Y.Z`) — no release branch.
- Forbidden: force-push to `main`; `--no-verify` on hooks.

---

## Commits: Conventional Commits

Format: `<type>(<scope>): <subject>`

| type       | When                                      |
| ---------- | ----------------------------------------- |
| `feat`     | New feature                               |
| `fix`      | Bug fix                                   |
| `docs`     | Documentation                             |
| `refactor` | Internal refactor (no behavior change)    |
| `chore`    | Tooling / dependency / build              |
| `test`     | Test changes                              |
| `style`    | Pure formatting (rare — Prettier handles) |

`commitlint` (via `commit-msg` hook) enforces the format.

Examples:

```
feat(server): add ws relay broadcast
fix(web): reconnect not triggered on 1006
docs(architecture): clarify heartbeat semantics
chore: bump prettier to 3.3
```

---

## Style: Prettier

- `.prettierrc.json` — single quote, semi, 100 cols, LF.
- Editor: install Prettier plugin, format on save.
- Pre-commit: `npm run format` (write) or `npm run format:check` (verify).
- `.editorconfig` enforces UTF-8 / LF / 2-space / final newline.

---

## Encoding / Line Endings

- UTF-8 (no BOM) + LF, always.
- `.gitattributes` enforces `* text=auto eol=lf`.
- Windows: Git auto-handles; Prettier/EditorConfig fix CRLF on save.

---

## Boundaries (what this project is NOT)

- No build tool (Vite / Webpack / etc.).
- No test framework — only `server/scripts/smoke.js`-level coverage.
- No direct commits to `main` for code changes (docs/chore exempt, see
  Branching above).
- No new web framework on the server (see
  `.trellis/spec/backend/quality-guidelines.md`).
- No UI framework on the front-end (see
  `.trellis/spec/frontend/quality-guidelines.md`).

---

## Release notes

`CHANGELOG.md` `[Unreleased]` is the source of truth for the next
release; `npm run release -- X.Y.Z` migrates it into a versioned
section that the tag-push workflow extracts as the GitHub Release body.

Writing style: [`release-notes.md`](./release-notes.md).
