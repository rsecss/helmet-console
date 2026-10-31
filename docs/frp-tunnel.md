# Local Relay Through an frp Tunnel

Use this guide to expose a locally running relay through your own frps server.
For relay environment variables and reverse-proxy headers, see [deployment](deployment.md).
All commands below run from the repository root unless stated otherwise.

## Topology and Prerequisites

```text
Browser -- HTTPS / WSS --> TLS reverse proxy -- TCP tunnel --> local relay :8080
Device  -- WS or WSS --> an ingress you configure --> the same relay
```

- Install project dependencies with `npm ci`. The launcher needs Python >=3.10.
- Provide a reachable VPS with frps configured, a shared authentication token,
  and a permitted TCP remote port. The example uses server port `7000` and remote port `13000`.
- For HTTPS/WSS, provide a domain and a TLS reverse proxy on the VPS forwarding
  to the tunnel's remote port. A CDN is optional.
- Install a compatible frpc client from the [frp releases](https://github.com/fatedier/frp/releases).
  Put `frpc.exe` (Windows) or `frpc` (Linux/macOS) under `deploy/`, or make it available on `PATH`.

## Configure and Start

Copy `deploy/frpc.example.toml` to `deploy/frpc.toml`:

```bash
cp deploy/frpc.example.toml deploy/frpc.toml
```

PowerShell:

```powershell
Copy-Item deploy/frpc.example.toml deploy/frpc.toml
```

Edit the local copy: set `serverAddr` and `auth.token` to your own values.
Make `serverPort` and `remotePort` agree with your frps setup.
Keep `localPort` aligned with the relay and launcher defaults (`8080`).
The real configuration and downloaded binaries are ignored by Git.

The launcher's `PUBLIC_HTTP_URL`, `PUBLIC_WS_URL`, and `DEVICE_WS_URL` are
hardcoded display labels from an earlier test environment. They do not configure
frpc, DNS, or TLS. Verify your own endpoints rather than relying on those labels.

```bash
python deploy/start.py
```

The launcher frees an occupied relay port, starts Node, waits up to 20 seconds,
and then starts frpc. **Freeing the port terminates the process using it.**
Use `npm start` when you want to start only the relay without that port cleanup.
`python deploy/start.py --local` skips frpc but still performs port cleanup.

Child output remains visible in the terminal. The launcher restarts the relay
after an unexpected exit and retries a failed frpc process after five seconds.
Missing frpc or configuration leaves the relay running locally. Stop with `Ctrl+C`.

## Verify

```bash
curl http://127.0.0.1:8080/healthz
curl https://YOUR_DOMAIN/healthz
```

Both should return a JSON object with `status: "ok"`, `uptime`, and `clients`.
Use GET for this check; `/healthz` has a dedicated GET handler.
Open your public HTTPS URL and connect to `wss://YOUR_DOMAIN/ws`.
Connect a second authorized client and verify frames using the [interface contract](interface.md).
A running frpc process or a launcher success label alone does not prove public reachability.

## Troubleshooting

| Symptom                        | Check                                                                      |
| ------------------------------ | -------------------------------------------------------------------------- |
| Relay startup timeout          | Node output, installed dependencies, and agreement on relay port           |
| Relay works locally, no tunnel | frpc availability, local config path, and visible frpc errors              |
| Authentication failure         | Shared token agreement between your frps and ignored frpc config           |
| Public URL fails               | DNS, TLS proxy, firewall, remote port, and GET `/healthz` through each hop |
| Printed public URLs are wrong  | Hardcoded launcher labels; use the endpoints from your own setup           |
| Browser loads but WS fails     | WebSocket upgrade headers, `/ws`, and WSS for an HTTPS page                |

The relay does not authenticate WebSocket peers. A public endpoint permits peers
to exchange frames, including device commands. Add an access boundary appropriate
to your deployment before exposing real device control, and use TLS for untrusted networks.

Keep personal topology notes under ignored `docs/local/`, without credentials.
Use the [operational script specification](../.trellis/spec/backend/operational-scripts.md)
when modifying the launcher. Runtime output belongs in root `logs/`; see
[capturing logs](deployment.md#capturing-logs).
