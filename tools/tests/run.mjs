#!/usr/bin/env node
/*
 * Behavioural tests for the things a grep cannot check.
 *
 *   npm test
 *
 * tools/scan.mjs asserts that the controls are still WRITTEN a particular way.
 * These run the real code and check it BEHAVES: that a 5000-key PUT cannot wedge
 * sync, that a September date is not answered from August, that fitness is not
 * seeded at zero, that a repeated ride lookup does not reach intervals.icu twice,
 * that a tap made mid-sync survives, and that scan.mjs itself actually fails when
 * any of it is put back.
 *
 * Every case here corresponds to a defect found in the August 2026 audit, so a
 * failure means one of them has returned. No test framework and no dependencies —
 * the repo has zero runtime dependencies and this keeps it that way.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tests = readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort();

let failed = 0;
for (const t of tests) {
  process.stdout.write(`\n\x1b[1m── ${t}\x1b[0m\n`);
  try {
    process.stdout.write(execFileSync(process.execPath, [join(here, t)], { encoding: 'utf8', stdio: 'pipe' }));
  } catch (e) {
    failed += 1;
    process.stdout.write(String(e.stdout || ''));
    process.stderr.write(String(e.stderr || ''));
    process.stdout.write(`\x1b[31m${t} FAILED\x1b[0m\n`);
  }
}

if (failed) {
  console.error(`\n\x1b[31m${failed} of ${tests.length} test file(s) failed\x1b[0m`);
  process.exit(1);
}
console.log(`\n\x1b[32mall ${tests.length} test files passed\x1b[0m`);
