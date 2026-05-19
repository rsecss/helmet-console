#!/usr/bin/env node
/**
 * Local release helper.
 *
 * Usage:
 *   npm run release -- <version>      e.g. npm run release -- 0.1.0
 *
 * Steps:
 *   1. Refuse unless on `main` with a clean working tree.
 *   2. Bump package.json#version.
 *   3. Move CHANGELOG.md `[Unreleased]` -> `[<version>] - YYYY-MM-DD`,
 *      insert an empty `[Unreleased]` placeholder, refresh link refs.
 *   4. Verify the new section is non-empty (extract-changelog.mjs).
 *   5. `git add` + `git commit -m "chore(release): v<version>"` + tag.
 *   6. Print the push command — does NOT push automatically.
 *
 * The push step is deliberately manual: pushing the tag fires the
 * Release workflow which publishes a public GitHub Release.
 *
 * Release-notes style guide: docs/release-notes.md
 * Sanity-check the `[Unreleased]` block against that guide BEFORE
 * running this script — its contents become the GitHub Release body.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const REPO = 'rsecss/helmet-console';

function sh(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
  console.error('Usage: npm run release -- <semver>   e.g. 0.1.0');
  process.exit(2);
}

// 1. Sanity checks
const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  fail(`refusing to release from "${branch}" — switch to main first`);
}
const status = sh('git status --porcelain');
if (status) {
  fail(`working tree not clean:\n${status}`);
}
try {
  sh(`git rev-parse "v${version}"`);
  fail(`tag v${version} already exists`);
} catch {
  /* expected: tag does not exist */
}

// 2. Bump package.json (preserve trailing newline + 2-space indent)
const pkgPath = resolve(root, 'package.json');
const pkgRaw = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgRaw);
const prevVersion = pkg.version;
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.info(`package.json: ${prevVersion} -> ${version}`);

// 3. CHANGELOG migration
const cmPath = resolve(root, 'CHANGELOG.md');
let cm = readFileSync(cmPath, 'utf8');
const today = new Date().toISOString().slice(0, 10);

if (!/^## \[Unreleased\]/m.test(cm)) {
  fail('CHANGELOG.md missing "## [Unreleased]" section');
}

// Replace the Unreleased heading with: empty Unreleased + new version heading.
// Preserve the body that was under Unreleased — it becomes the new release body.
const emptyUnreleased = '## [Unreleased]\n\n_Nothing yet._\n\n';
cm = cm.replace(/^## \[Unreleased\][^\n]*\n/m, `${emptyUnreleased}## [${version}] - ${today}\n`);

// Refresh the Unreleased ref + insert the new version ref right below it.
// Preserve any existing [X.Y.Z]: refs from prior releases.
const unreleasedRefRe = /^\[Unreleased\]:[^\n]*$/m;
const newRefs =
  `[Unreleased]: https://github.com/${REPO}/compare/v${version}...HEAD\n` +
  `[${version}]: https://github.com/${REPO}/releases/tag/v${version}`;
if (unreleasedRefRe.test(cm)) {
  cm = cm.replace(unreleasedRefRe, newRefs);
} else {
  cm = cm.trimEnd() + '\n\n' + newRefs + '\n';
}

writeFileSync(cmPath, cm);
console.info(`CHANGELOG.md: moved [Unreleased] -> [${version}] (${today})`);

// 4. Verify extraction works (catches malformed CHANGELOG)
const extract = spawnSync(process.execPath, [resolve(here, 'extract-changelog.mjs'), version], {
  cwd: root,
  encoding: 'utf8',
});
if (extract.status !== 0 || !extract.stdout.trim()) {
  fail(`extract-changelog.mjs ${version} failed:\n${extract.stderr}`);
}
console.info(`CHANGELOG section [${version}] extracted OK (${extract.stdout.length} chars)`);

// 5. Commit + tag
sh('git add package.json CHANGELOG.md');
sh(`git commit -m "chore(release): v${version}"`);
sh(`git tag -a "v${version}" -m "Release v${version}"`);
console.info(`✓ created commit + tag v${version}`);

// 6. Manual push hint
console.info('');
console.info('Next:');
console.info('  git push origin main --follow-tags');
console.info('');
console.info('That triggers .github/workflows/release.yml which will:');
console.info('  - validate the tag matches package.json');
console.info('  - re-run the full quality gate on Node 18/20/22');
console.info('  - publish a GitHub Release with the CHANGELOG section as notes');
