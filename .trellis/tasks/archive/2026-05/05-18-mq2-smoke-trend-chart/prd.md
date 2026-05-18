# MQ2 Smoke Trend Chart

## Goal

Add a frontend panel widget that parses incoming flat UTF-8 telemetry frames and shows a real-time smooth MQ2 smoke / harmful gas trend chart.

## Requirements

- Parse WebSocket text frames as newline-delimited telemetry lines.
- Parse each complete line as comma-separated `key=value` fields, splitting only on the first `=`.
- Convert `mq2` to `number` and `mq2_alarm` to `boolean`.
- Ignore unknown fields, empty lines, malformed fields, and lines without a valid `mq2`.
- Keep recent MQ2 samples only, covering roughly the last 60 to 120 seconds.
- Render MQ2 as a smooth curve, not a polyline.
- Use receive time for the X axis and MQ2 trend index for the Y axis.
- Show reference lines at clean air `100`, alarm threshold `180`, and recovery threshold `130`.
- When `mq2_alarm=1`, show an obvious smoke abnormal state and visually highlight the chart.
- UI copy must use "MQ2 烟雾趋势指数"; do not present the value as precise ppm concentration.
- Preserve the terminal display of incoming frames and the existing WS text protocol.

## Acceptance Criteria

- [ ] A frame like `temp=23,hum=60,mq2=120,mq2_alarm=0\n` adds one sample to the chart without errors.
- [ ] A frame like `mq2=200,mq2_alarm=1\n` updates the chart and displays "烟雾异常".
- [ ] Frames split across WebSocket messages are buffered until `\n` arrives.
- [ ] Empty frames, unknown fields, malformed fields, and frames missing `mq2` are ignored.
- [ ] Samples older than the retention window are pruned.
- [ ] `npm run lint`, `npm run format:check`, and `npm test` pass.

## Technical Notes

- Frontend only: native ESM under `web/`, no framework, no build tool.
- Do not add CDN imports. Use a small local SVG renderer instead of introducing a new vendored chart library for this single telemetry curve.
- Wire through `main.js#onFrame`; keep module boundaries and single-writer rules intact.
