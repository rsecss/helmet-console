# Release Notes Style Guide

Release notes live in `CHANGELOG.md` and are extracted verbatim by the
GitHub Release workflow. Write for the **reader of the release page**,
not the author of the commits.

---

## Template

```
## [X.Y.Z] - YYYY-MM-DD

<one-line tagline summarising the release>

### Highlights          (optional — 1–3 user-visible wins; omit for patches)
- ...

### Added                (new user-facing features)
- ...

### Changed              (behaviour changes that aren't bug fixes)
- ...

### Fixed                (user-visible bug fixes)
- ...

### Documentation        (optional — only when notable)
- ...

### Breaking Changes     (only when any — must include a migration line)
- ...
```

Use Keep-a-Changelog section names. **Drop sections that have nothing
in them.** A patch release may only have `### Fixed`.

---

## Rules of thumb

- **Lead with user-visible effect, not implementation.**
  - ✅ "Fast disconnect/reconnect no longer leaves the UI stuck in a
    stale state."
  - ❌ "`ws-client.js` now captures `activeSocket` and short-circuits
    stale handlers."
- **One line per bullet** (~140 chars max). If you need a paragraph,
  it belongs in the PR description or commit body, not here.
- **Reference PR / issue** at the end when one exists: `(#123)`.
- **Cite a file path** only when contributors need to grep for it —
  rare in user-facing notes.
- **Skip internal noise**: Trellis metadata, journal recordings, CI
  tweaks invisible to users, mid-task refactors no one notices.
- **Group repeating bullets**: three doc updates of the same kind = one
  line, not three.
- **Breaking changes must include a migration step**:
  - "Removed `legacyFlag` config; replace with `flag.legacy = true`."
- **Tagline rule**: one neutral sentence. No emoji, no marketing
  copy, no "🎉".

---

## Workflow

1. As work merges, append entries under `## [Unreleased]` in the right
   section.
2. Before cutting a release, sanity-check the Unreleased block against
   this guide: trim implementation jargon, group similar bullets, drop
   empty sections, add a tagline.
3. `npm run release -- X.Y.Z` migrates `[Unreleased]` → `[X.Y.Z]`,
   inserts a fresh empty `[Unreleased]` with `_Nothing yet._`, bumps
   `package.json`, commits, tags.
4. `git push origin main --follow-tags` triggers
   `.github/workflows/release.yml`, which extracts the `[X.Y.Z]` block
   as the GitHub Release body.

---

## Example (good)

```
## [0.2.0] - 2026-06-10

Adds device telemetry persistence and tightens the AI tool-call surface.

### Added

- Telemetry frames are now persisted across reconnects (#42).
- `motor_brake` tool-call recognised by the AI view (#45).

### Changed

- Connection toast auto-dismisses after 3 s instead of staying sticky.

### Fixed

- AI view no longer double-sends a tool-call when the user retries (#48).

### Breaking Changes

- Removed `console.ws.legacy_url`. Migrate by saving the new
  `console.ws.url` once, then clearing the old key from `localStorage`.
```

## Example (bad — don't do this)

```
## [0.2.0] - 2026-06-10

### Added
- Refactored `panel-view.js` to delegate telemetry persistence to a new
  `telemetry-store.js` module that wraps `localStorage` with a
  throttled write queue keyed on `device_id` so that across reconnects
  the last 90 seconds of MQ2 / temp / hum samples survive a page
  reload, with the buffer rotating at 1 Hz and writes coalescing every
  500 ms (see `panel-view.js:204`, `telemetry-store.js:1`).
```

Reasons it's bad: implementation detail, no user effect, file paths,
no one-line discipline.
