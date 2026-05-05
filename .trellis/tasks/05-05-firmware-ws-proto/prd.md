# Firmware WebSocket Protocol Library

## Goal

Provide a low-coupling C99 application-layer library for the helmet MCU
side that:

1. Builds telemetry uplink frames (env/IMU/vital/state) into the
   project's KV-string wire format.
2. Parses downlink command frames (`led_on` / `led_off` /
   `motor_speed_<0..3>` / `ping` / `pong`) into hardware callbacks.
3. Stays agnostic of the underlying transport (4G module AT, ESP32
   lwIP, simulator, …) — actual byte send is delegated via a
   `send_frame` callback.

This library lives in `firmware/helmet_proto/` and is **not** wired
into the Node host server build. It is shipped as portable source for
embedded targets to drop into their own build system.

## Boundary (what this library is NOT)

- **Not** a WebSocket protocol implementation (no RFC 6455 handshake,
  no frame masking) — that responsibility belongs to the 4G module
  stack or lwIP. The library only handles the application payload
  (`led_on\n`, `temp=...\n`, etc.).
- **Not** a transport — `send_frame` callback is the integration seam.
- **Not** a heartbeat driver — heartbeat is browser↔server only per
  `architecture.md` §6.3; the device merely ignores `ping`/`pong`.

## Wire Format

### Uplink (device → host) — single frame, comma-separated KV

```
temp=23.5,hum=60,mq2=120,pitch=1.20,roll=-0.50,yaw=180.00,hr=72,spo2=98,led=1,motor=0\n
```

Field order (grouped by physical domain):

| Group   | Field | Type    | Format    | Note                              |
| ------- | ----- | ------- | --------- | --------------------------------- |
| env     | temp  | float   | `%.1f`    | °C                                |
| env     | hum   | uint8   | `%u`      | %RH                               |
| env     | mq2   | uint16  | `%u`      | raw ADC                           |
| imu     | pitch | float   | `%.2f`    | degrees                           |
| imu     | roll  | float   | `%.2f`    | degrees                           |
| imu     | yaw   | float   | `%.2f`    | degrees                           |
| vital   | hr    | uint8   | `%u`      | bpm                               |
| vital   | spo2  | uint8   | `%u`      | %                                 |
| state   | led   | 0/1     | `%u`      | mirror of last applied LED state  |
| state   | motor | 0..3    | `%u`      | mirror of last applied motor gear |

> Why include `led` / `motor` mirrors? `architecture.md` §9 lists
> "控件区双向回读" as a deferred extension; the device side prepares
> the mirror fields now so the browser can adopt them later without a
> firmware re-flash.

### Downlink (host → device) — command dictionary v1

| Frame                  | Action                          |
| ---------------------- | ------------------------------- |
| `led_on\n`             | invoke `cb.led_set(true)`       |
| `led_off\n`            | invoke `cb.led_set(false)`      |
| `motor_speed_<0..3>\n` | invoke `cb.motor_set_speed(N)`  |
| `ping\n` / `pong\n`    | silently ignored                |
| anything else          | invoke `cb.on_unknown(line)`    |

## Public API

```c
typedef struct {
    float    temp;     // °C
    uint8_t  hum;      // %RH
    uint16_t mq2;      // raw
    float    pitch;    // degrees
    float    roll;
    float    yaw;
    uint8_t  hr;       // bpm
    uint8_t  spo2;     // %
    uint8_t  led;      // 0/1
    uint8_t  motor;    // 0..3
} helmet_telemetry_t;

typedef struct {
    void (*led_set)(bool on, void *user);
    void (*motor_set_speed)(uint8_t level, void *user);
    void (*on_unknown)(const char *line, size_t len, void *user);
    void (*send_frame)(const char *buf, size_t len, void *user);
    void *user;
} helmet_proto_callbacks_t;

typedef struct helmet_proto helmet_proto_t;   // opaque

void helmet_proto_init(helmet_proto_t *p, const helmet_proto_callbacks_t *cb);
void helmet_proto_feed(helmet_proto_t *p, const char *data, size_t len);
int  helmet_proto_send_telemetry(helmet_proto_t *p, const helmet_telemetry_t *t);
int  helmet_proto_send_text(helmet_proto_t *p, const char *line);  // raw passthrough; appends \n if missing
```

Returns: `0` on success, negative on buffer overflow / send error.

## Constraints

- **C99**, freestanding-friendly (no `malloc`, no `errno` use).
- **No hidden state**: `helmet_proto_t` is fully owned by caller; user
  declares it as a variable / member and passes pointer.
- **Buffer sizes**: RX line buffer 256 B; TX scratch buffer 192 B.
  Overflow → drop current line and resync at next `\n`.
- **Float formatting**: relies on libc `snprintf("%f")` — caller must
  enable printf-float on toolchains that gate it (e.g., newlib-nano
  `--specs=nano.specs -u _printf_float`). Documented in header.
- **Thread safety**: the struct is single-threaded; if RX comes from
  ISR, caller queues bytes and calls `feed` from main loop.

## Files

| Path                                            | Purpose                       |
| ----------------------------------------------- | ----------------------------- |
| `firmware/helmet_proto/helmet_proto.h`          | Public API + types + doc      |
| `firmware/helmet_proto/helmet_proto.c`          | Implementation                |
| `firmware/helmet_proto/example/example_main.c`  | Usage demo with stub callbacks |
| `firmware/helmet_proto/README.md`               | Quick start + integration notes |

## Acceptance Criteria

- [ ] Header compiles standalone (no dependencies beyond `<stdint.h>`,
      `<stdbool.h>`, `<stddef.h>`).
- [ ] `helmet_proto_send_telemetry` produces exactly the wire format
      above for a known input vector.
- [ ] `helmet_proto_feed` byte-by-byte produces same callback sequence
      as feeding the whole buffer at once (frame boundary independence).
- [ ] `motor_speed_4` and `motor_speed_-1` are routed to `on_unknown`,
      not `motor_set_speed`.
- [ ] `ping\n` and `pong\n` produce **no** callbacks (silently
      ignored).
- [ ] Example builds with `gcc -Wall -Wextra -std=c99 -pedantic`
      cleanly and demonstrates a round trip.

## Technical Notes

- The library is intentionally stateless beyond the RX line buffer;
  callers wanting periodic telemetry should drive
  `helmet_proto_send_telemetry` from their own scheduler.
- Frame parsing uses `strncmp` exclusively (no `strtok`, no regex) to
  match the design rationale in `architecture.md` §4.1.
- The example uses POSIX `read`/`write` over stdio so it runs on a
  desktop without an MCU; comments mark where to swap in
  `HAL_UART_Transmit` / `at_cmd_send` etc.
