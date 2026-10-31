# Pin Trellis and Generate Local AI Tooling

## Goal

Keep project-specific workflow knowledge in Git while generating AI tool adapters locally from the pinned Trellis release.

## Requirements

- Pin `@mindfoldhq/trellis` to the existing `0.4.0` release as a development dependency.
- Provide an explicit initialization command that preserves existing project files.
- Verify regeneration against all 44 currently tracked AI tool files before removing them from the index.
- Ignore root `.agents/`, `.claude/`, and `.codex/` while keeping local files and tracked project specifications.
- Ignore the local template fingerprints that initialization always refreshes.
- Consolidate setup, ownership, and upgrade instructions in `docs/contributing.md`; link from the READMEs and agent instructions.
- Follow GitHub Flow on `chore/trellis-local-tooling` and open a PR after validation.

## Acceptance Criteria

- [x] The package manifest and lockfile pin Trellis `0.4.0` exactly.
- [x] A clean temporary checkout regenerates the required AI adapters and preserves tracked project knowledge.
- [x] Repeating initialization preserves existing files.
- [x] Generated AI directories are ignored and no longer tracked, with local contents retained.
- [x] Relevant quality checks pass and documentation matches verified commands.
- [x] Changes are committed on the feature branch and submitted as a PR.

## Command Contract

`npm run trellis:init -- --user <name>` uses the local pinned CLI with Claude Code and Codex enabled and existing files skipped. Initialization is opt-in, not part of install, startup, or CI.

Validation cases: fresh clone creates missing adapters; a repeat run preserves adapters and project rules; an unavailable or mismatched release must not be substituted with the global CLI.

## Verification

Compare generated adapters with tracked originals, compare tracked file hashes before and after initialization, run `git check-ignore`, `npm test`, `npm run format:check`, and `git diff --check`.

## Results

- The locked temporary install resolves Trellis `0.4.0`; all 44 adapters match the originals.
- Initialization preserves 62 tracked project files; repeated runs preserve local adapter edits and restore a missing adapter.
- `npm test`, `npm run format:check`, task-context validation, and Git whitespace checks pass.
- The 44 original adapter files remain present locally after removal from the index.
- PR: https://github.com/rsecss/helmet-console/pull/7
- Remote checks pass: Node.js 18/20/22 quality gates and commit-message validation.
