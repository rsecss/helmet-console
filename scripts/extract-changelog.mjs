#!/usr/bin/env node
/**
 * Extract a single version's section from CHANGELOG.md and print it to stdout.
 *
 * Usage:
 *   node scripts/extract-changelog.mjs <version>
 *
 *   <version>  e.g. "0.1.0" or "Unreleased"
 *
 * Exits with:
 *   0 — section printed
 *   1 — version not found
 *   2 — bad usage
 *
 * Used by .github/workflows/release.yml to feed `gh release create
 * --notes-file`.  The CHANGELOG follows Keep a Changelog format:
 *
 *   ## [Unreleased]
 *   ...
 *   ## [0.1.0] - 2026-05-06
 *   ...
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node scripts/extract-changelog.mjs <version>');
  process.exit(2);
}

const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');

const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headingRe = new RegExp(`^## \\[${escaped}\\][^\\n]*$`, 'm');
const startMatch = headingRe.exec(changelog);
if (!startMatch) {
  console.error(`Version "${target}" not found in CHANGELOG.md`);
  process.exit(1);
}

const after = changelog.slice(startMatch.index + startMatch[0].length);
const nextRe = /^## \[/m;
const nextMatch = nextRe.exec(after);
const body = nextMatch ? after.slice(0, nextMatch.index) : after;

process.stdout.write(body.trim() + '\n');
