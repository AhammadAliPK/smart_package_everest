#!/usr/bin/env node
/**
 * Boundary-enforcement proof (AD-2).
 *
 * The repo contains committed fixtures that *violate* the inward-only
 * dependency rule — one per zone:
 *
 *   packages/domain/src/__fixtures__/boundary-violation.fixture.ts
 *   apps/api/src/application/__fixtures__/boundary-violation.fixture.ts
 *
 * This script lints each fixture with `--no-ignore` (they are excluded from the
 * normal lint pass) and asserts that ESLint fails on every one of them with
 * `no-restricted-imports`. If ESLint ever stops catching these imports, this
 * script exits non-zero and `turbo lint` goes red — the rule cannot silently
 * rot.
 *
 * Run via `pnpm turbo run lint` (root task `//#check:boundaries`) or directly:
 * `pnpm check:boundaries`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const fixtures = [
  'packages/domain/src/__fixtures__/boundary-violation.fixture.ts',
  'apps/api/src/application/__fixtures__/boundary-violation.fixture.ts',
  'packages/ui/src/__fixtures__/boundary-violation.fixture.ts',
  'apps/web/src/__fixtures__/boundary-violation.fixture.ts',
];

const eslintBin = join(repoRoot, 'node_modules', '.bin', 'eslint');
if (!existsSync(eslintBin)) {
  console.error(
    `check:boundaries — ESLint binary not found at ${eslintBin}. Run \`pnpm install\` first.`,
  );
  process.exit(1);
}

const results = [];

for (const fixture of fixtures) {
  const absolute = join(repoRoot, fixture);
  if (!existsSync(absolute)) {
    console.error(`check:boundaries — fixture is missing: ${fixture}`);
    results.push({ fixture, ok: false, reason: 'missing fixture' });
    continue;
  }

  const run = spawnSync(eslintBin, ['--no-ignore', absolute], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  // ESLint exits 1 when it reports problems, 0 when the file is clean.
  const failed = run.status === 1;
  const blamedRightRule =
    typeof run.stdout === 'string' &&
    run.stdout.includes('no-restricted-imports');

  if (failed && blamedRightRule) {
    results.push({ fixture, ok: true });
    continue;
  }

  results.push({
    fixture,
    ok: false,
    reason: failed
      ? `ESLint failed but not with no-restricted-imports:\n${run.stdout}${run.stderr}`
      : `ESLint exited ${run.status} (expected 1) — the violation was NOT caught:\n${run.stdout}${run.stderr}`,
  });
}

let failures = 0;
for (const result of results) {
  if (result.ok) {
    console.log(
      `check:boundaries — OK  ${result.fixture} (lint correctly fails)`,
    );
  } else {
    failures += 1;
    console.error(`check:boundaries — FAIL ${result.fixture}`);
    console.error(result.reason);
  }
}

if (failures > 0) {
  console.error(
    `\ncheck:boundaries — ${failures}/${results.length} boundary fixture(s) not rejected. AD-2 enforcement is broken.`,
  );
  process.exit(1);
}

console.log(
  'check:boundaries — all boundary fixtures rejected by lint (AD-2 enforced).',
);
