# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project
adheres to [Semantic Versioning](https://semver.org/) once it ships.

## [Unreleased]

### Added

- **MQ2 smoke trend chart**: the panel view's `.data-card` now hosts a
  live trend chart. `web/js/telemetry-panel.js` parses flat UTF-8
  newline-delimited telemetry frames (`temp=23,hum=60,mq2=120,mq2_alarm=0\n`)
  from `main.js#onFrame`, buffers across WS message boundaries, and
  silently ignores blank / malformed / `mq2`-less lines (terminal still
  echoes the raw frame). A small local SVG renderer draws a smooth
  bezier curve with three reference lines (clean 100, recovery 130,
  alarm 180) over a 90-second rolling window. When `mq2_alarm=1` the
  card flips to alarm state — `data-mq2-alarm='true'`, status text
  `烟雾异常`, curve recolors rose — and reverts on the next non-alarm
  sample. Copy stays at "MQ2 烟雾趋势指数" (trend index, not ppm). No
  chart library / CDN imports; wire and relay unchanged.

### Changed

- **Panel layout polish**: the data card hero block is tighter (smaller
  current-value, denser padding, removed sample-count / updated-at meta
  row) so the chart gets the remaining vertical space. LED card now
  stretches to match the motor card's height via
  `.control-cards { align-items: stretch }`.
- **README mermaid diagrams**: stripped HTML-style labels (`<br/>`,
  emoji, quoted text) in favor of plain-text labels with named-edge
  arrows. Topology unchanged; fixes inconsistent rendering across
  Markdown viewers.

### Documentation

- `docs/architecture.md` — module diagram now includes
  `telemetry-panel.js`; "Telemetry chart" removed from the deferred-
  extensions list.
- `.trellis/spec/frontend/quality-guidelines.md` — added telemetry-panel
  ownership row, `createTelemetryPanel` / `parseTelemetryLine`
  signatures, validation-matrix entries for MQ2 framing, and MQ2 manual
  test cases. `.data-card` removed from the reserved-placeholder table.
- `.trellis/spec/frontend/directory-structure.md` — `telemetry-panel.js`
  added to the module map.

## [0.1.1] - 2026-05-18

### Added

- **MQ2 smoke trend chart**: the panel view's `.data-card` now hosts a
  live trend chart. `web/js/telemetry-panel.js` parses flat UTF-8
  newline-delimited telemetry frames (`temp=23,hum=60,mq2=120,mq2_alarm=0\n`)
  from `main.js#onFrame`, buffers across WS message boundaries, and
  silently ignores blank / malformed / `mq2`-less lines (terminal still
  echoes the raw frame). A small local SVG renderer draws a smooth
  bezier curve with three reference lines (clean 100, recovery 130,
  alarm 180) over a 90-second rolling window. When `mq2_alarm=1` the
  card flips to alarm state — `data-mq2-alarm='true'`, status text
  `烟雾异常`, curve recolors rose — and reverts on the next non-alarm
  sample. Copy stays at "MQ2 烟雾趋势指数" (trend index, not ppm). No
  chart library / CDN imports; wire and relay unchanged.

### Changed

- **Panel layout polish**: the data card hero block is tighter (smaller
  current-value, denser padding, removed sample-count / updated-at meta
  row) so the chart gets the remaining vertical space. LED card now
  stretches to match the motor card's height via
  `.control-cards { align-items: stretch }`.
- **README mermaid diagrams**: stripped HTML-style labels (`<br/>`,
  emoji, quoted text) in favor of plain-text labels with named-edge
  arrows. Topology unchanged; fixes inconsistent rendering across
  Markdown viewers.

### Documentation

- `docs/architecture.md` — module diagram now includes
  `telemetry-panel.js`; "Telemetry chart" removed from the deferred-
  extensions list.
- `.trellis/spec/frontend/quality-guidelines.md` — added telemetry-panel
  ownership row, `createTelemetryPanel` / `parseTelemetryLine`
  signatures, validation-matrix entries for MQ2 framing, and MQ2 manual
  test cases. `.data-card` removed from the reserved-placeholder table.
- `.trellis/spec/frontend/directory-structure.md` — `telemetry-panel.js`
  added to the module map.

## [0.1.0] - 2026-05-05

### Added

- **AI device-state context**: `ai-panel.js` injects a `[当前设备状态]`
  system message before each user turn and appends a state card to AI
  bubbles after every tool round, with a `⚠ 设备未连接` note when WS is
  down. New `statusQueryButton` triggers a state-card-only bubble.
- **`state:` snapshot frames**: every successful control / AI-tool send
  is followed by a best-effort `state:led=…,motor=…\n` frame so future
  browser clients can mirror UI without a server roundtrip.
- **xterm direction markers**: outgoing frames prefix with red `[↓]`,
  incoming with blue `[↑]` (web display only — wire and `ws-cli.js`
  stay byte-faithful).
- **Panel view (LED + motor + reserved telemetry slot)**: third
  `data-view='panel'` owns LED, motor switch/gear, and a `.data-card`
  placeholder for future device-side telemetry.
- **Motor switch + gear (1..3)**: replaces the 0..5 single-value slider
  with a two-axis model (power gate + target gear). Wire keeps the flat
  `motor_speed_<0..3>`. Passive memory: changing gear while switch is
  OFF only updates in-memory state.
- **DeepSeek AI assistant view**: in-browser DeepSeek V4 chat with
  `tool_calls` → `led_on` / `led_off` / `led_color_<color>` /
  `motor_speed_<n>`. API key stored in `localStorage`; never reaches
  the server.
- **`server/scripts/ws-cli.js`**: manual e2e WebSocket client; plays
  the device role for tunnel verification. Buffers stdin during
  `CONNECTING` so scripted `echo "..." | ws-cli.js` doesn't drop the
  first frame.
- **`deploy/start.py`**: one-shot launcher that boots `npm start` +
  `frpc`, supervises both, and prints connection URLs.
- **`deploy/deploy.md`**: local-first frp tunnel setup (BYO domain /
  VPS / token) with operational rules cross-linked to spec.
- **`deploy/frpc.example.toml`**: template for the (gitignored) real
  frpc config.

### Changed

- **WebSocket protocol → flat strings**: removed the JSON envelope
  (`from`/`type`/`payload`). Each frame is now a single UTF-8 text line
  ending in `\n`. MCU dispatches with `strncmp`; server is a pure byte
  passthrough (only exception: `ping` → `pong\n`).
- **3-state UI surface**: collapsed the 5 internal `ws-client` states
  onto 3 visual states (`disconnected` / `connected` / `error`) driven
  by `.app-shell[data-state]`. Internal state machine unchanged.
- **Single URL input**: replaced the multi-field host/port/path/tls
  form with one `ws://host:port/path` input parsed via `parseWsUrl`.
  Persistence stays backward-compatible (5 `console.ws.*` keys).
- **Rose-themed UI**: `web/` is now a 1:1 replica of
  `docs/design/prototype-rose.html` (white floor, rose accents, GitHub
  Light ANSI palette).
- **`defaultUrl()` fallback fix**: only bare local origins
  (`127.0.0.1`/`localhost` without an explicit port) default to
  `:8080`. Reverse-proxied deploys (`https://example.com`) now use the
  scheme-standard port instead of mis-targeting `:8080`.
- **Spec consolidation**: backend / frontend `quality-guidelines.md`
  trimmed of duplication with `directory-structure.md`,
  `state-management.md`, `error-handling.md`. Deferred specs
  (database / component / hook) compressed.

### Documentation

- README rewritten for open-source release: features, architecture
  diagram, quick start, deployment paths, doc index.
- `docs/architecture.md` re-organized; module diagram now reflects all
  three views.
- `docs/contributing.md`, `docs/deployment.md`, `docs/interface.md`
  trimmed of restated content.
- `AGENTS.md` reduced to a Trellis pointer + minimal project snapshot.

### Initial Bootstrap

- Project scaffolded with Trellis workflow, ESLint flat config,
  Prettier, `simple-git-hooks` + `commitlint` (Conventional Commits),
  `.editorconfig`, `.gitattributes` (LF enforced).
- Initial WebSocket console: `server/` (composition + `sirv` + `ws`),
  `web/` (xterm-based UI), `server/scripts/smoke.js` (HTTP / WS / ping
  / binary-close coverage).
- GitHub Actions CI/CD: quality gate on Node 18/20/22
  (`format:check` / `lint` / `smoke`), commitlint on PRs, and a
  tag-triggered release workflow that extracts the matching
  `CHANGELOG.md` section as Release notes. Bundled with issue / PR
  templates, `CODEOWNERS`, and a `npm run release -- X.Y.Z` helper.

[Unreleased]: https://github.com/rsecss/helmet-console/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/rsecss/helmet-console/releases/tag/v0.1.1
[0.1.0]: https://github.com/rsecss/helmet-console/releases/tag/v0.1.0
