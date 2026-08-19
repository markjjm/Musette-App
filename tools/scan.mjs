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

/* Every sheet is shown by `.sheet.open`. A handler that adds any other class
   leaves the panel at display:none, so the button does nothing and says nothing.
   That shipped once, on the helper. */
{
  const opens = [...html.matchAll(/\$\('#([\w-]*sheet)'\)\.classList\.add\('([\w-]+)'\)/g)];
  for (const [, id, cls] of opens) {
    if (cls !== 'open') err(`#${id} is opened with .${cls}, but only .sheet.open has a rule — the panel will stay hidden`);
  }
}

/* ---- 6. The plan's own arithmetic --------------------------------------
   Why this is in a security scan: the audit's structural finding was that this
   repo's invariants live in English and nothing executes them. Four of eight
   defects were a comment or SECURITY.md describing a control that was not in the
   code. A documented control that is not a failing test is worse than no
   control, because it is what stops you looking. So the claims get tests.

   The specific evidence that it was already biting: plan.json and the BUNDLED
   copy in index.html are two hand-maintained copies of the same figures, and
   they had already drifted apart. A computed column cannot do that. */
const PLAN = join(root, 'plan.json');
let plan = null, bundled = null;
try {
  plan = JSON.parse(readFileSync(PLAN, 'utf8')).plan;
} catch {
  err('plan.json is missing or not valid JSON');
}
{
  const m = /^const BUNDLED = (\{.*\});\s*$/m.exec(html);
  if (!m) err('index.html has no single-line `const BUNDLED = {...};` - the plan checks below cannot run');
  else {
    try { bundled = JSON.parse(m[1]); } catch { err('the BUNDLED plan literal in index.html is not valid JSON'); }
  }
}

/* Green today, on both copies, so this locks in what is already right: a day's
   meals sum EXACTLY to the day's own kc and cb. These totals are precomputed in
   the bundle, so editing one end and not the other drifts them silently — which
   is why every meal edit in this repo has to re-check the day total. */
for (const [name, p] of [['plan.json', plan], ['index.html BUNDLED', bundled]]) {
  if (!p || !Array.isArray(p.days)) continue;
  for (const d of p.days) {
    const meals = Array.isArray(d.meals) ? d.meals : [];
    const kc = meals.reduce((a, m) => a + (m.kc || 0), 0);
    const cb = meals.reduce((a, m) => a + (m.cb || 0), 0);
    if (kc !== d.kc) err(`${name} day ${d.d}: meals sum to ${kc} kcal but the day says ${d.kc}`);
    if (cb !== d.cb) err(`${name} day ${d.d}: meals sum to ${cb} g carb but the day says ${d.cb}`);
  }
}

/* Fails on 16 of 31 days, worst 12.8%. A warning rather than an error, and the
   reason it is safe to leave as a warning is that the app no longer trusts these
   figures: macroRow() now reads the same reconciliation and shows a ? instead of
   a verdict, so an unreconciled fat number can neither raise the low-fat warning
   nor clear it. Before that it could only clear it — day 28 displayed 21.1%
   against a real 16.9%, and nine other days cleared on the same overstatement.

   day.pr and day.ft are day-type templates rather than sums of the meals: days
   3, 24 and 31 share pr=152 ft=71 across three entirely different meal sets.
   Computing them from the items needs per-item protein and fat, which needs a
   name-to-food mapping for the plan's item strings AND label figures for the
   dozen foods that are not in data/foods.json. Once that exists and these days
   reconcile, promote this to err() and delete the ? branch in macroRow. */
{
  const off = [];
  for (const d of (plan && plan.days) || []) {
    if (!d.kc) continue;
    const calc = 4 * (d.pr || 0) + 9 * (d.ft || 0) + 4 * (d.cb || 0);
    const pct = Math.abs(calc - d.kc) / d.kc * 100;
    if (pct > 3) off.push(`${d.d} (${pct.toFixed(1)}%)`);
  }
  if (off.length) {
    warn(
      `plan.json: 4*pr + 9*ft + 4*cb is more than 3% from kc on ${off.length} day(s): ${off.join(', ')}` +
      ' - pr/ft are day-type templates, not sums; macroRow() shows ? on these days rather than judging them'
    );
  }
  /* The check that keeps that promise. macroRow must decide on the reconciliation
     and not on ft alone, or the false clear comes straight back. */
  if (!/const reconciles\s*=/.test(html) || !/reconciles && \(9 \* ft\)/.test(html)) {
    err('index.html macroRow() no longer gates the low-fat warning on whether pr/ft reconcile - an overstated estimate can clear it again');
  }
}

/* The two copies must be the same plan, and this is now an ERROR because they
   agree. It was a warning for one commit, while they did not: "Bacon on the
   burgers" edited BUNDLED and _headers and left plan.json behind, so the deployed
   app showed day 1 at 4249 kcal while plan.json — the copy tools/publish-plan.py
   sends to the Worker — still said 4163, and publishing would have silently
   undone the bacon. Two hand-maintained copies of the same figures will drift
   again the moment nothing is watching, and the whole cost of that is one
   comparison. */
if (plan && bundled) {
  const a = JSON.stringify(plan), b = JSON.stringify(bundled);
  if (a !== b) {
    const where = [];
    for (const key of new Set([...Object.keys(plan), ...Object.keys(bundled)])) {
      if (JSON.stringify(plan[key]) !== JSON.stringify(bundled[key])) where.push(key);
    }
    const days = [];
    for (const d of plan.days || []) {
      const o = (bundled.days || []).find((x) => x.d === d.d);
      if (o && JSON.stringify(o) !== JSON.stringify(d)) days.push(d.d);
    }
    err(
      `plan.json and index.html BUNDLED have drifted: ${where.join(', ')} differ` +
      (days.length ? ` (days ${days.join(', ')})` : '') +
      ' - they are two copies of one plan; edit both or neither'
    );
  }
}

/* ---- 7. Controls the docs promise ------------------------------------
   Each of these was, at some point, true only in prose.

   Several checks below read the Worker's structure, and this file's comments
   quote the very code they describe — the route guards, the dates that used to be
   hardcoded. Match against the code with comments stripped, or a check gets its
   answer from the prose it is supposed to be verifying. Both false positives that
   happened while writing this section were exactly that. */
const workerCode = worker.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* The 5000-key ceiling. It used to be `let budget = MAX_ENTRIES` counting
   iterations over the INCOMING map, so every request brought a fresh allowance
   and the stored map had no ceiling at all - one 79 KB PUT wedged sync for both
   phones permanently. The fix measures the RESULT, so the test is that the
   result is what gets measured. */
if (/let\s+budget\s*=\s*MAX_ENTRIES/.test(worker)) {
  err('worker.js mergeByTime counts iterations over the incoming map again - MAX_ENTRIES must cap the RESULT map, not the loop');
}
if (!/Object\.keys\(out\)\.length/.test(worker)) {
  err('worker.js mergeByTime does not measure the result map (Object.keys(out).length) - the per-map ceiling is not enforced');
}
/* And bytes, not just entries: five capped maps still add up. Asserted on the
   behaviour rather than on a variable name, which is what the first version did —
   renaming `after` to `afterWire` turned the check red with nothing wrong. */
{
  const m = /const syncedWire = [\s\S]*?;\n/.exec(worker);
  if (!m) {
    err('worker.js has no syncedWire() - merge() cannot be pricing what the client must send');
  } else {
    /* The measure must cover the five synced maps and NOTHING else. Charging the
       whole stored state against a request-body limit refused writes whose real
       round trip was ~77 KB under it, because `plan` is in there and the client
       never sends it. */
    for (const map of ['ticks', 'extras', 'pantry', 'log', 'dishes']) {
      if (!new RegExp(`\\b${map}\\b`).test(m[0])) {
        err(`worker.js syncedWire() does not include ${map} - the size guard is measuring the wrong body`);
      }
    }
    if (/\bplan\b/.test(m[0])) {
      err('worker.js syncedWire() includes plan - the client never PUTs the plan, so charging it against MAX_BODY refuses writes that fit');
    }
  }
  const mg = /async merge\(body\)[\s\S]*?\n  \}/.exec(worker);
  if (!mg) err('worker.js has no merge() - cannot verify the size guard');
  else if (!/>\s*MAX_BODY/.test(mg[0])) {
    err('worker.js merge() does not price what the client must send back against MAX_BODY - a copy too big to PUT cannot be recovered from the client');
  }
}
/* Every synced map needs a way to shrink. pantry had none at all.

   Scoped to prune()'s own body on purpose. Grepping the whole file for
   `Object.entries(state.pantry` passes on an unrelated line in coachFacts, so the
   check would have reported a control that was not there — which is the entire
   failure this section exists to stop. Found by deliberately deleting the loop
   and watching the scan stay green. */
{
  const body = /function prune\(state\) \{[\s\S]*?\n\}/.exec(worker);
  if (!body) err('worker.js has no prune() - the synced maps have no way to shrink');
  else {
    for (const map of ['ticks', 'extras', 'log', 'dishes', 'pantry']) {
      if (!new RegExp(`Object\\.entries\\(state\\.${map}\\b`).test(body[0])) {
        err(`worker.js prune() never looks at state.${map} - that map can only ever grow`);
      }
    }
  }
}

/* A month hardcoded in the Worker. plan.block is the only thing that knows which
   month the plan's day numbers belong to; two string literals used to assume
   August, which would have started answering from the wrong month on 1 September
   while returning HTTP 200. */
{
  /* Two shapes, because the first draft of this check anchored on the CLOSING
     delimiter and so missed the very literal the bug was made of:
     `2026-08-${String(dayNum).padStart(2, '0')}` has an interpolation where the
     closing backtick would be. A guardrail that cannot catch the defect it was
     written for is the thing this whole section exists to prevent.

       (a) a string or template that OPENS with a year-month
       (b) a full ISO date anywhere, which is never legitimate arithmetic */
  const hard = [
    ...workerCode.matchAll(/['"`]\s*\d{4}-\d{2}/g),
    ...workerCode.matchAll(/\d{4}-\d{2}-\d{2}/g),
  ].map((m) => m[0].trim());
  if (hard.length) {
    err(`worker.js hardcodes ${hard.length} calendar date(s) (${hard.join(', ')}) - derive the month from plan.block via blockYM()`);
  }
}
if (!/function blockYM\(/.test(worker)) {
  err('worker.js has no blockYM() - nothing ties the plan\'s day numbers to a month');
}

/* SECURITY.md and the route comments both claimed ride responses were
   edge-cached. Only /rides was; /ride's free path was a live call to
   intervals.icu on the owner's key, once per request. The cache now lives in
   fetchRides so no future route can forget it - assert that, and assert that
   nothing else reaches upstream directly. */
{
  /* Every RIDE READ goes through fetchRides, which is where the cache is.
     icuVerify() is the one allowed exception and it is allowed by name rather
     than by raising a count: it checks a credential once, when somebody links
     their account, and caching that would mean a key that has since been
     revoked keeps appearing to work. A second unnamed call site is still an
     error, because that is how the unmetered proxy came back last time. */
  const icuCalls = [...worker.matchAll(/fetch\(`\$\{ICU\}/g)].length;
  const verifyBody = /async function icuVerify\([\s\S]*?\n\}/.exec(worker);
  const verifyCalls = verifyBody ? [...verifyBody[0].matchAll(/fetch\(`\$\{ICU\}/g)].length : 0;
  if (icuCalls - verifyCalls > 1) {
    err(`worker.js calls intervals.icu from ${icuCalls - verifyCalls} places outside icuVerify() - all ride reads must go through fetchRides, which is where the cache is`);
  }
  if (verifyCalls > 1) {
    err(`icuVerify() makes ${verifyCalls} upstream calls - it is a single credential check, not a fetcher`);
  }
  const fr = /async function fetchRides\([\s\S]*?\n\}/.exec(worker);
  if (!fr) err('worker.js has no fetchRides() - cannot verify ride responses are cached');
  else if (!/caches\.default/.test(fr[0])) {
    err('worker.js fetchRides() does not use caches.default - SECURITY.md claims ride responses are edge-cached for ten minutes');
  }
}
/* A cache hit must never be served by rebuilding a Response from the stored
   copy. That copy carries only Content-Type and max-age, so spreading its
   headers dropped no-store, nosniff and no-referrer and inverted the caching
   directive - and because Vary named only Origin, the browser then re-served
   heart rate, power and ride names for the rest of the TTL even against a wrong
   access code. json() owns response headers; a hit must go back through it. */
/* Any identifier, not a list of three guesses at what it might be called: the
   first version matched only `hit`, `cached` and `stored`, so the identical
   regression under any other name slipped through as a warning. */
if (/\.\.\.Object\.fromEntries\(\s*\w+\.headers\s*\)/.test(worker)) {
  err('worker.js builds a client response by spreading a cached copy\'s headers - no-store, nosniff and no-referrer are lost that way; return json(body) instead');
}
/* Three constructions are expected and accounted for: json() itself, the copy
   stored in the edge cache, and the bodiless OPTIONS 204. A fourth is a second
   place for response headers to be got wrong. */
{
  const news = [...worker.matchAll(/new Response\(/g)].length;
  if (news > 3) {
    warn(`worker.js constructs ${news} raw Responses, expected 3 (json(), the cache copy, OPTIONS 204) - every client response should come from json()`);
  }
}

/* "Only `/ride`'s no-why path is unbounded" was true once, and the whole point of
   this section is that such a sentence has to be executable. Every route that
   spends money on a model must pass a budget gate first. Split on the route
   guards and check each block that calls askModel(); /food goes through
   lookupFood(), which carries its own separate daily ceiling. */
{
  /* Tolerant of spacing, because splitting on the exact string `if (path === `
     would attribute a merely reformatted route to its neighbour's block — and
     then check a missing budget gate against a different route's gate. */
  const blocks = workerCode.split(/if\s*\(\s*path\s*===\s*/).slice(1);
  for (const b of blocks) {
    const route = (/^'([^']+)'/.exec(b) || [])[1] || '?';
    if (!/askModel\(/.test(b)) continue;
    if (!/\.spend\(\)/.test(b)) {
      err(`worker.js route ${route} calls askModel() without listStub(env).spend() - that is an unmetered path to a paid model`);
    }
  }
  const fb = /async function lookupFood\([\s\S]*?\n\}/.exec(worker);
  if (!fb) err('worker.js has no lookupFood()');
  else if (!/foodBudget\(/.test(fb[0])) {
    err('worker.js lookupFood() has no foodBudget() gate - /food would be an unmetered path to a paid model');
  }
  /* A new askModel() call site is worth a look even when it is gated. */
  const sites = [...worker.matchAll(/await askModel\(/g)].length;
  if (sites !== 6) {
    warn(`worker.js has ${sites} askModel() call sites, expected 6 (/ask, /coach, /analyze, /ride?why, /food, /summary) - confirm the new one is behind a budget`);
  }
}

/* Form is a measurement, so its window must not be a client parameter. ?weeks=2
   used to move the same rider from "Tired" to "Deep in it" and fabricate a
   +7.8/week build on dead-constant load. */
if (!/const FORM_DAYS\s*=/.test(worker)) {
  err('worker.js has no FORM_DAYS constant - the fitness window is whatever each caller passed, so endpoints can disagree');
}
if (/trainingForm\([^)]*weeks/.test(worker)) {
  err('worker.js derives the fitness window from `weeks`, which is client-supplied - form must not be steerable');
}
/* Seeded at zero, CTL was not an average of anything: at a steady 60 TSS/day it
   returned 37.4 against a truth of 60, and formCard read that as "Tired". */
if (/let ctl = 0, atl = 0;/.test(worker)) {
  err('worker.js trainingForm seeds CTL/ATL at zero again - warm-start them, or fitness reads low and form reads buried');
}

/* ---- 8. Zero runtime dependencies ------------------------------------
   The load-bearing claim of this whole repo's supply-chain posture, stated in
   SECURITY.md and socket.yml: nothing from npm reaches a browser or the Worker,
   which is why a CVE in the dependency tree is a dev-machine question and not a
   production one. Five undici CVEs arrived on 10 August 2026 and the answer was
   "unreachable" — an answer only worth trusting if something checks it.

   The check is the lockfile, not the prose: every installed package must be
   dev-only. The day one is not, the reasoning above stops holding and the alert
   triage has to change with it. */
{
  const LOCK = join(root, 'package-lock.json');
  let lock = null;
  try {
    lock = JSON.parse(readFileSync(LOCK, 'utf8'));
  } catch {
    err('package-lock.json is missing or not valid JSON - the zero-runtime-dependency claim cannot be checked');
  }
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
    err(
      `package.json declares runtime dependencies (${Object.keys(pkg.dependencies).join(', ')}) - ` +
      'SECURITY.md and socket.yml both state there are none, and the alert triage for this repo depends on it'
    );
  }
  if (lock && lock.packages) {
    const shipped = Object.entries(lock.packages)
      .filter(([name, v]) => name && !v.dev && !v.optional)
      .map(([name]) => name.replace(/^node_modules\//, ''));
    if (shipped.length) {
      err(
        `package-lock.json has ${shipped.length} non-dev package(s) (${shipped.slice(0, 5).join(', ')}` +
        `${shipped.length > 5 ? ', …' : ''}) - a CVE in the tree is now a production question, not a tooling one`
      );
    }
  }
  /* An exact pin, not a range: socket.yml makes Socket the review step for
     dependency changes, and it can only review what arrives as a pull request.
     A caret lets `npm install` pick up a new version with no PR to review. */
  for (const [name, range] of Object.entries(pkg.devDependencies || {})) {
    if (!/^\d+\.\d+\.\d+$/.test(range)) {
      warn(`package.json pins ${name} as "${range}" rather than an exact version - a range can change the tree with no PR for Socket to review`);
    }
  }
}

/* ---- Report ---------------------------------------------------------- */
for (const w of warnings) console.log(`\x1b[33mWARN\x1b[0m  ${w}`);
if (fail.length) {
  for (const f of fail) console.error(`\x1b[31mFAIL\x1b[0m  ${f}`);
  console.error(`\nscan: ${fail.length} problem(s)`);
  process.exit(1);
}
console.log(`\x1b[32mscan: clean\x1b[0m (${found.length} interpolations approved)`);
