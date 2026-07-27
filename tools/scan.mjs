#!/usr/bin/env node
/*
 * Security regression scan. Runs in CI and on pre-commit.
 *
 * Design goal: zero false positives, so a red result always means something.
 * Rather than guessing whether an HTML interpolation is safe, every one is
 * baselined in tools/interp-baseline.json after review. A new or changed
 * interpolation fails the scan until a human re-baselines it.
 *
 *   npm run scan            check everything
 *   npm run scan:baseline   re-approve interpolations after reviewing a diff
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(root, 'web/public/index.html');
const WORKER = join(root, 'worker/worker.js');
const TOML = join(root, 'worker/wrangler.toml');
const BASELINE = join(root, 'tools/interp-baseline.json');

const fail = [];
const warnings = [];
const err = (m) => fail.push(m);
const warn = (m) => warnings.push(m);

/* ---- 1. Never-acceptable sinks ---------------------------------------- */
const html = readFileSync(HTML, 'utf8');
const worker = readFileSync(WORKER, 'utf8');

const BANNED = [
  [/\beval\s*\(/, 'eval()'],
  [/\bnew\s+Function\s*\(/, 'new Function()'],
  [/\bdocument\.write\s*\(/, 'document.write()'],
  [/\binsertAdjacentHTML\s*\(/, 'insertAdjacentHTML()'],
  [/\bouterHTML\s*=/, 'outerHTML assignment'],
  [/\bsetTimeout\s*\(\s*['"]/, 'setTimeout with a string body'],
  [/\bsrcdoc\s*=/, 'iframe srcdoc'],
];
for (const [re, name] of BANNED) {
  if (re.test(html)) err(`index.html uses ${name}`);
}

/* Every HTML-producing template relies on esc(). Pin its exact definition:
   weakening the escaper would silently defeat the baseline check below.
   If you intentionally change esc(), review it and update this constant. */
const ESC_EXPECTED =
  `const esc = s => String(s).replace(/[&<>"']/g, ` +
  `c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));`;
if (!html.includes(ESC_EXPECTED)) {
  err('the esc() escaper has been modified - review it, then update ESC_EXPECTED in tools/scan.mjs');
}

/* ---- 2. Baselined HTML interpolations --------------------------------- */
function interpolations(src) {
  const out = [];
  for (let i = 0; i < src.length - 1; i++) {
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < src.length) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}' && --depth === 0) break;
        j++;
      }
      const expr = src.slice(i + 2, j).replace(/\s+/g, ' ').trim();
      if (expr) out.push(expr);
    }
  }
  return [...new Set(out)].sort();
}

const found = interpolations(html);

if (process.argv.includes('--baseline')) {
  writeFileSync(BASELINE, JSON.stringify(found, null, 2) + '\n');
  console.log(`scan: baselined ${found.length} interpolations`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  err('tools/interp-baseline.json missing - run `npm run scan:baseline`');
} else {
  const approved = new Set(JSON.parse(readFileSync(BASELINE, 'utf8')));
  const added = found.filter((e) => !approved.has(e));
  for (const e of added) {
    /* Unreviewed interpolation. Safe ones still need sign-off, because the
       point is that a human looked at the HTML context. */
    const looksEscaped = /\besc\(|\bNumber\(|\.toFixed\(/.test(e);
    err(
      `unreviewed HTML interpolation \${${e.slice(0, 70)}}` +
        (looksEscaped ? ' (appears escaped - re-baseline to approve)' : ' <-- NOT obviously escaped')
    );
  }
}

/* ---- 3. Worker invariants -------------------------------------------- */
if (/['"]Access-Control-Allow-Origin['"]\s*:\s*['"]\*['"]/.test(worker)) {
  err('worker.js sends Access-Control-Allow-Origin: *');
}
for (const secret of ['LIST_KEY', 'ADMIN_KEY']) {
  const direct = new RegExp(`[!=]==\\s*env\\.${secret}|env\\.${secret}\\s*[!=]==`);
  if (direct.test(worker)) {
    err(`worker.js compares env.${secret} with ===/!== (timing-unsafe); use safeEqual()`);
  }
  if (!new RegExp(`safeEqual\\([\\s\\S]{0,120}?env\\.${secret}`).test(worker)) {
    err(`worker.js does not compare env.${secret} via safeEqual()`);
  }
}
if (!/MAX_BODY/.test(worker)) err('worker.js has no request body size cap');
if (!/env\.RL/.test(worker)) warn('worker.js has no rate-limit check');

/* ---- 4. Secret hygiene ----------------------------------------------- */
if (/(LIST_KEY|ADMIN_KEY)\s*=\s*['"][^'"]{6,}/.test(readFileSync(TOML, 'utf8'))) {
  err('wrangler.toml appears to contain a plaintext secret - use `wrangler secret put`');
}
let tracked = [];
try {
  tracked = execFileSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).split('\n');
} catch {
  warn('not a git repository yet - skipping tracked-file secret check');
}
for (const f of tracked) {
  if (/(^|\/)\.dev\.vars$/.test(f)) err(`.dev.vars is tracked by git (${f}) - it holds local secrets`);
}

/* ---- 5. CSP freshness ------------------------------------------------ */
try {
  execFileSync(process.execPath, [join(root, 'tools/build-csp.mjs'), '--check'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  });
} catch (e) {
  err(`CSP: ${String(e.stdout || e.stderr || e.message).trim().split('\n').join(' ')}`);
}

/* ---- Report ---------------------------------------------------------- */
for (const w of warnings) console.log(`\x1b[33mWARN\x1b[0m  ${w}`);
if (fail.length) {
  for (const f of fail) console.error(`\x1b[31mFAIL\x1b[0m  ${f}`);
  console.error(`\nscan: ${fail.length} problem(s)`);
  process.exit(1);
}
console.log(`\x1b[32mscan: clean\x1b[0m (${found.length} interpolations approved)`);
