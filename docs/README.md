# Documentation

The repository [README](../README.md) is the GitHub entry point and the project
overview, written in Simplified Chinese. This index and the guides below are in
English; they cover detailed guidance and file ownership.

## Reading Paths

| Goal                                | Read                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Run the console                     | Root README quick start, then [deployment](deployment.md)                      |
| Connect a device                    | [HTTP and WebSocket interface](interface.md)                                   |
| Understand the implementation       | [Architecture](architecture.md)                                                |
| Expose a local instance through frp | [Tunnel setup and troubleshooting](frp-tunnel.md)                              |
| Contribute code or use AI tooling   | [Contributing](contributing.md) and [coding specifications](../.trellis/spec/) |
| Prepare a release                   | [Release notes guide](release-notes.md) and [changelog](../CHANGELOG.md)       |

## Directory and Commit Boundaries

| Location                                         | Purpose                                          | Commit?                               |
| ------------------------------------------------ | ------------------------------------------------ | ------------------------------------- |
| Root `README.md`                                 | Project overview and quick start                 | Yes                                   |
| `docs/*.md`                                      | Reusable architecture, contracts, and guides     | Yes                                   |
| `docs/assets/screenshots/`                       | Screenshots referenced by public documentation   | Yes                                   |
| `deploy/start.py`, `deploy/frpc.example.toml`    | Launcher and placeholder configuration           | Yes                                   |
| `AGENTS.md`, `.trellis/` project rules and tasks | Contributor contracts and tracked work           | Yes, except local state ignored there |
| `docs/design/`                                   | Optional local prototypes and experiments        | No                                    |
| `docs/local/`                                    | Non-secret personal environment notes and drafts | No                                    |
| `deploy/frpc.toml`                               | Real machine-specific tunnel configuration       | No                                    |
| `deploy/frpc`, `deploy/frpc.exe`                 | Downloaded third-party binaries                  | No                                    |
| Root `logs/` and `*.log`                         | Captured runtime output                          | No                                    |
| Root `.agents/`, `.claude/`, `.codex/`           | Generated AI tool adapters                       | No                                    |

Git does not store empty directories. Create local notes and log directories
only when needed; do not add placeholder files to force them into Git.
Never put credentials in public documentation, screenshots, tasks, or journals.
Keep secrets in the ignored runtime configuration or the appropriate secret store.

## Maintain One Source Per Topic

- `interface.md` owns the wire contract; architecture explains the surrounding design.
- `deployment.md` owns relay configuration and reverse-proxy guidance.
- `frp-tunnel.md` owns launcher setup, verification, and troubleshooting.
- `contributing.md` owns development commands and review workflow.
- `.trellis/spec/` owns coding constraints, with links to the relevant guides.
- The tracked `web/` implementation defines current UI behavior. Screenshots are
  illustrative references, not a replacement for the running UI; local prototypes are optional.

Use placeholders in reusable deployment examples. Keep historical investigation
details in task records; track remaining work as tasks instead of duplicating
backlogs in operational guides. When moving a guide, update active links and
specification references in the same PR. Historical journals remain historical.
