# Contributing

Helmet Console aims to stay a **lightweight** WebSocket relay. Changes
follow KISS — no complexity unrelated to the goal.

---

## Setup

```bash
npm ci                 # locked dependencies + git hooks
npm test               # ESLint + unit tests + smoke
npm run format:check   # Prettier check
```

`npm ci` runs `prepare` to install the `commit-msg` hook. Use `npm install`
when intentionally changing dependencies and commit the lockfile with the manifest.

## AI-Assisted Development (Optional)

The project pins `@mindfoldhq/trellis` to **0.4.0** in `devDependencies`
and `package-lock.json`, matching `.trellis/.version`. AI tooling requires
Node.js >=18.17 and Python >=3.10. No global Trellis install is needed.

After `npm ci`, initialize the local Claude Code and Codex adapters:

```bash
npm run trellis:init -- --user your-name
python ./.trellis/scripts/get_developer.py
```

The npm script uses the pinned local CLI with
`--claude --codex --skip-existing --yes`. It creates missing adapters and a local developer
identity; repeat runs keep existing files and identity. Setup is explicit:
application startup and CI do not run Trellis initialization.

Existing contributors should run these setup commands after pulling the change
that removes adapters from Git, since Git may remove the formerly tracked files.

| Tracked project knowledge                              | Generated locally and ignored        |
| ------------------------------------------------------ | ------------------------------------ |
| `AGENTS.md`, `.trellis/spec/`, `.trellis/workflow.md`  | `.agents/`, `.claude/`, `.codex/`    |
| `.trellis/scripts/`, configuration, tasks and journals | `.trellis/.template-hashes.json`     |
| `.trellis/.version`, dependency manifest and lockfile  | Developer identity and runtime state |

Put shared project rules in the tracked files. Adapter edits are local;
initialization skips them, and clones do not receive them. New custom
skills or hooks need a tracked source and a documented installation step
before the project can depend on them.

Trellis initialization refreshes local template fingerprints. After setup,
`git status --short` should show no tracked changes except a new developer's
workspace. Start sessions with `.trellis/workflow.md` and the generated
Trellis start skill or command.

### Updating Trellis

Use a dedicated `chore/` branch and PR. Change the exact development
dependency and lockfile, then preview with `npm exec -- trellis update --dry-run`.
Use `npm exec -- trellis update` to review and apply changes to the tracked
workflow, scripts, and version marker.
Keep existing project rules; do not use force or overwrite flags for setup.

Before merging, initialize a temporary clean checkout with the new version,
verify required adapters, check that initialization preserves tracked rules,
and repeat it to verify existing local adapters remain intact. Run the quality
checks above and update this guide's version. `trellis:init` fills missing
files; it does not upgrade existing adapters. Contributors upgrading an
existing checkout must review updates with the local CLI as well.

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

## Style and Encoding

- `.prettierrc.json` — single quote, semi, 100 cols, LF.
- Editor: install Prettier plugin, format on save.
- Pre-commit: `npm run format` (write) or `npm run format:check` (verify).
- `.editorconfig` enforces UTF-8 / LF / 2-space / final newline.
- UTF-8 (no BOM) + LF, always.
- `.gitattributes` enforces `* text=auto eol=lf`.

---

## Boundaries (what this project is NOT)

- No build tool (Vite / Webpack / etc.).
- Use Node's built-in test runner for unit tests and `server/scripts/smoke.js`
  for HTTP/WebSocket integration checks.
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
