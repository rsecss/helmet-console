# WebSocket CLI Test Client

## Goal

Add a small Node CLI that connects to the relay over WebSocket so a
developer can play the "device" role (simulated MCU) on the local
machine. Combined with the existing browser console, this enables manual
end-to-end verification of the frp tunnel: bytes sent from the public
browser (`wss://websocket.vaple.cc/ws`) reach the local CLI byte-for-byte,
and bytes typed into the CLI show up verbatim in the browser terminal.

This fills the gap left by `server/scripts/smoke.js`, which only exercises
the loopback path.

## Requirements

- New script at `server/scripts/ws-cli.js` (ESM, runnable via plain `node`).
- Connects to `ws://127.0.0.1:8080/ws` by default; accepts an optional
  positional URL argument to override (e.g., a frp tunnel URL).
- Reads `stdin` line-by-line (`readline` over `process.stdin`).
  - Each non-empty line becomes one text frame.
  - Append `\n` if the line does not already end with `\n` (matches
    the wire protocol: every command terminates with `\n`).
  - Empty lines are skipped (avoid sending bare `\n` heartbeats).
- Writes incoming text frames to `stdout` byte-for-byte
  (`process.stdout.write(text)`) — no rewrites, no trimming, so byte
  completeness is visible.
- Discards incoming binary frames with a single `console.warn` line
  (`[ws-cli] dropped binary frame (N bytes)`) — the relay's contract
  forbids binary, but a defensive log keeps surprises visible.
- Status messages (connect / close / error) all go through
  `console.info` / `console.warn` / `console.error` with the
  `[ws-cli]` tag prefix; no `console.log`.
- `Ctrl+C` / `SIGINT` triggers a graceful close (`ws.close(1000)`);
  the process exits when the socket closes.
- No automatic ping (heartbeat is a browser-side concern, not the
  device's). No automatic reconnect (manual restart on drop).
- Reuses the existing `ws` dependency; introduces no new packages.

## Acceptance Criteria

- [ ] `node server/scripts/ws-cli.js` connects to local relay and stays
      connected; `Ctrl+C` exits cleanly with status 0.
- [ ] With one browser open against the public wss URL and one CLI
      connected to the local relay, typing `led_on` + Enter in the
      browser console prints `led_on\n` byte-for-byte in the CLI's
      stdout, and typing `temp=42.3` + Enter in the CLI shows
      `temp=42.3` in the browser terminal.
- [ ] `node server/scripts/ws-cli.js ws://127.0.0.1:8080/ws` works the
      same as the no-arg default (explicit URL passes through).
- [ ] Sending a binary frame does not happen from the CLI (text only),
      and an inbound binary frame (manual injection) is logged and
      discarded without crashing.
- [ ] `npm run lint` passes (no new ESLint warnings).
- [ ] `npm run smoke` still passes (no regression in existing relay
      behaviour).

## Technical Notes

- File layout follows `server/scripts/smoke.js` precedent (operational
  Node script outside `server/src/`, no exports, runs top-level await).
- Default URL is built from `server/src/config.js` import (do not
  hard-code `8080` / `/ws` — read `config.port` and `config.wsPath`).
  This matches the "three-place port constant" rule: changing
  `PORT` automatically updates the CLI's default target.
- Use `readline.createInterface({ input: process.stdin })` rather than
  raw mode; one frame per line is enough for manual debugging.
- Do not echo the user's own input — `readline` already echoes when
  attached to a TTY, and we want the user's bytes and the relay's
  return path to be visually distinguishable (user types on the left,
  inbound frames stream from the relay).
- The script does not need to appear in `package.json` `scripts` —
  it is a developer ergonomics tool, not part of `npm test`. Keeping
  it out of `npm run` avoids polluting the test pipeline.

## Out of Scope

- Auto-reconnect (operator restarts the script).
- Binary frame send (forbidden by the protocol).
- Hex / dump mode (YAGNI; raw stdout is enough for the planned check).
- An automated end-to-end harness over the public tunnel — frp link
  state is not deterministic enough for CI.
