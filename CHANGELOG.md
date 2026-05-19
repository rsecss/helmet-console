# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project
adheres to [Semantic Versioning](https://semver.org/) once it ships.

Writing style: see [`docs/release-notes.md`](docs/release-notes.md).

## [Unreleased]

_Nothing yet._

## [0.1.2] - 2026-05-19

Mobile-friendly layout and a fix for the rapid disconnect/reconnect
race in the WS client.

### Fixed

- Rapid disconnect/reconnect no longer leaves the UI in a stale state —
  late events from old sockets are ignored.
- Narrow viewports (≤768 px) now render the full console: vertical
  stack, dynamic `100dvh` height, reflowed topbar and connection bar.

### Added

- `npm run test:unit` (Node built-in test runner) wired into `npm test`,
  with coverage for the WS client active-socket guard.

### Documentation

- Frontend spec records the WS active-socket guard contract and the
  unit tests it requires.
- README mermaid diagram and WebSocket frame table render correctly on
  GitHub again.

## [0.1.1] - 2026-05-18

Adds the MQ2 smoke trend chart and tightens the panel view layout.

### Added

- **MQ2 smoke trend chart**: the device panel now hosts a 90-second
  live trend curve with three reference lines (clean / recovery /
  alarm). When the device sends `mq2_alarm=1`, the card flips to alarm
  state — rose-coloured curve, "烟雾异常" status — and reverts on the
  next clean sample. Pure SVG; no chart library.

### Changed

- Tighter panel layout: the data-card hero block gives the trend chart
  more vertical space; the LED card now aligns to the motor card's
  height.
- README mermaid diagrams switched to plain-text labels so they render
  consistently across GitHub, VS Code, and offline markdown viewers.

## [0.1.0] - 2026-05-05

Initial open-source release: a lightweight WebSocket relay console for
embedded devices with terminal, AI assistant, and device panel views.

### Highlights

- **Three views**: terminal (xterm-based), AI assistant (in-browser
  DeepSeek V4 with `tool_calls` → flat-text commands), and a device
  panel for LED + motor + telemetry.
- **MCU-friendly protocol**: each frame is a UTF-8 line ending in `\n`.
  MCU dispatches with `strcmp` — no JSON, no length prefix, no masking
  layer.
- **Resilient WS client**: 5-state machine, exponential backoff
  (1/2/4/8/16 s), 30 s heartbeat, 45 s stale detection.
- **AI sees device state**: every AI turn carries a
  `[当前设备状态]` system message and pins a state card to each tool
  round; an explicit "状态查询" button surfaces it on demand.
- **Local-first deployment**: works on `localhost` out of the box;
  one-line frp tunnel script (`deploy/start.py`) for public access.

### Added

- `server/scripts/ws-cli.js`: manual end-to-end WebSocket client that
  plays the device role for tunnel verification.
- Motor switch + gear (1..3) with passive memory — changing gear while
  the switch is off only updates in-memory state.
- xterm direction markers — red `[↓]` outgoing, blue `[↑]` incoming
  (web display only; wire stays byte-faithful).
- `state:` snapshot frames after every control / AI-tool send so
  future browser clients can mirror UI without a server roundtrip.

### Project Bootstrap

- Trellis workflow, ESLint flat config, Prettier,
  `simple-git-hooks` + commitlint, `.editorconfig`, `.gitattributes`.
- GitHub Actions CI/CD: Node 18/20/22 quality-gate matrix, commitlint
  on PRs, tag-triggered release workflow that publishes a Release with
  the matching `CHANGELOG.md` section.
- Issue / PR templates, `CODEOWNERS`, `npm run release -- X.Y.Z` helper.

[Unreleased]: https://github.com/rsecss/helmet-console/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/rsecss/helmet-console/releases/tag/v0.1.2
[0.1.1]: https://github.com/rsecss/helmet-console/releases/tag/v0.1.1
[0.1.0]: https://github.com/rsecss/helmet-console/releases/tag/v0.1.0
