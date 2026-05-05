# Interface

## HTTP

| Method | Path       | Response                                     |
| ------ | ---------- | -------------------------------------------- |
| `GET`  | `/`        | `web/index.html`                             |
| `GET`  | `/healthz` | `{ "status":"ok", "uptime":0, "clients":0 }` |
| `GET`  | `/*`       | Static files under `web/`                    |

Non-`GET`/`HEAD` requests return `405`.

## WebSocket

Path defaults to `/ws`.

Each frame is a single UTF-8 **text** WebSocket message — one command per
frame, terminated by `\n`. Binary frames are not supported. There is no
JSON envelope, no length prefix, no server-side field schema; the wire is
the command.

```text
led_on\n
led_off\n
led_color_red\n
motor_speed_3\n
state:led=red,motor=3\n
ping\n
pong\n
```

| Direction       | Frame examples                           | Notes                           |
| --------------- | ---------------------------------------- | ------------------------------- | -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| browser → MCU   | `led_on\n` `led_off\n` `led*color*<white | red                             | green>\n` `motor*speed*<0..3>\n` | Free-form text from the command bar also allowed |
| browser → peers | `state:led=<off                          | white                           | red                              | green>,motor=<0..3>\n`                           | Best-effort UI snapshot emitted after controls; server still only relays |
| MCU → browser   | any UTF-8 text (e.g. `temp=42.3\n`)      | Server passes through unchanged |
| client ↔ server | `ping\n` / `pong\n`                      | See heartbeat below             |

The frame is the command. Multi-line input from the command bar is split
on `\n` by the browser before sending; each non-empty line becomes its
own frame so devices never have to handle frame boundaries. Browser
control widgets and AI tools also emit a best-effort `state:` snapshot
frame immediately after each successful control command; devices may
ignore it, while future browser clients can parse it for cross-client UI
mirroring.

## Relay Behavior

| Input                        | Server behavior                                                                |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Text frame `ping` / `ping\n` | Reply only to sender with `pong\n`; do not broadcast                           |
| Any other text frame         | Broadcast to every connected client except sender, byte-for-byte unchanged     |
| Binary frame                 | Close the offending socket with code `1003 unsupported data`; do not broadcast |

The server never inspects, parses, or rewrites text payloads. It does
not append `\n`, normalize case, or add timestamps — that is the
sender's responsibility.

## Heartbeat

The browser client sends `ping\n` every 30 seconds. The server replies
with `pong\n`. If the client receives no frame (any frame counts —
`pong` or device data) for 45 seconds, it closes the socket and
attempts to reconnect.

The browser drops incoming `pong\n` so the terminal does not show
heartbeat traffic. Devices SHOULD ignore `pong` frames they happen to
receive from other clients.

## Browser UI Contract

- The terminal area is display-only and writes incoming frames verbatim
  via `term.write(text)`.
- Browser commands are sent from the command textarea verbatim, with a
  trailing `\n` appended if missing. Multi-line input is split on `\n`
  and sent line-by-line.
- The command input and send button are disabled until the WebSocket is
  connected.
