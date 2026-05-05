<!--
Thanks for the PR!  Keep the title in Conventional Commits format,
e.g. `feat(web): add motor switch`. Squash-merge is OK; merge-commit
preserves history — both are acceptable depending on the change set.
-->

## Summary

<!-- 1–3 bullets describing what & why. Link any issue (`Closes #123`). -->

## Type

<!-- Check one — must align with the commit `type(scope):` -->

- [ ] `feat` — new feature
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — internal change, no behavior delta
- [ ] `chore` — tooling / deps / CI
- [ ] `test` — test changes
- [ ] `style` — formatting only

## Checklist

- [ ] Commits follow Conventional Commits (`type(scope): subject`)
- [ ] `npm test` (lint + smoke) passes locally
- [ ] `npm run format:check` passes
- [ ] `CHANGELOG.md` `[Unreleased]` updated (or N/A: tooling-only chore)
- [ ] Docs updated (`docs/`, `README.md`) if user-visible behavior changed
- [ ] No new dependency added without justification (this project stays lightweight)

## Breaking changes

<!-- "None", or describe migration path. WS protocol is wire-stable —
     any change there must be called out explicitly. -->

## Smoke / manual test notes

<!-- e.g. tested on Node 22 + Chrome; reproduced the device side with
     `node server/scripts/ws-cli.js`; confirmed `state:` snapshot
     mirrors across two browsers. -->
