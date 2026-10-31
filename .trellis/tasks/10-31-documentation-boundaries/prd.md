# Organize Documentation and Local Artifacts

## Goal

Give contributors one documentation index and explicit boundaries between public documentation, deployment files, and local artifacts. Keep both repository READMEs at the root for GitHub.

## Requirements

- Add `docs/README.md` as a documentation index with reading paths and a tracked/ignored file matrix.
- Replace `deploy/deploy.md` with a reusable `docs/frp-tunnel.md`; remove personal environment details and historical task lists from the public guide.
- Keep deployment scripts and example configuration in `deploy/`, and real configuration and downloaded binaries ignored.
- Reserve ignored `docs/local/` for non-secret personal notes and `logs/` for captured output; retain existing files.
- Keep root READMEs, synchronize current references, and use tracked UI implementation and screenshots as the visual baseline.
- Preserve deployment behavior; only correct stale comments in the launcher.
- Record still-applicable structural deployment followups as a separate task; leave historical journals unchanged.
- Work on `docs/documentation-boundaries` and submit a PR without merging.

## Acceptance Criteria

- [x] Root READMEs remain and link to the documentation index.
- [x] All current links resolve and no active references use the retired deployment guide.
- [x] Guides and specifications agree on tracked files, private configuration, local notes, prototypes, and logs.
- [x] No private configuration or log content is read or committed; existing local artifacts are retained.
- [x] The launcher has identical executable behavior.
- [x] Formatting, relevant quality checks, and task validation pass.
- [ ] Changes are committed and submitted as a PR.

## Verification

Check local Markdown links and anchors, Git tracking and ignore rules, launcher AST equivalence, UTF-8/LF, `npm test`, `npm run format:check`, and Git whitespace checks. Do not run the launcher: it can terminate processes on the relay port.

## Results

- Checked 84 local Markdown links and anchors across the READMEs, docs, and specifications.
- Launcher executable AST and CSS outside comments are unchanged.
- `npm test`, `npm run format:check`, task-context validation, and whitespace checks pass.
- Local logs, prototypes, frpc configuration, and binaries remain local and ignored.
- Structural launcher followups are recorded in task `10-31-deployment-hardening-review`; no deployment changes were executed.
