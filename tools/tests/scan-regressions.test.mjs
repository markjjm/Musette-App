/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* A guardrail nobody has tried to break is a guess. Copy the repo, reintroduce
   each defect the audit found, and require the scan to fail — with the right
   message. Anything that still passes is a control that does not exist. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');

function freshCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'scanreg-'));
  for (const p of ['tools', 'worker', 'plan.json', 'package.json', 'package-lock.json']) {
    cpSync(join(SRC, p), join(dir, p), { recursive: true });
  }
  mkdirSync(join(dir, 'web/public'), { recursive: true });
  cpSync(join(SRC, 'web/public'), join(dir, 'web/public'), { recursive: true });
  return dir;
}

function runScan(dir) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'tools/scan.mjs')], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

const edit = (dir, rel, from, to) => {
  const p = join(dir, rel);
  const s = readFileSync(p, 'utf8');
  if (!s.includes(from)) throw new Error(`mutation target not found in ${rel}: ${from.slice(0, 70)}`);
  writeFileSync(p, s.replace(from, to));
};

/* Each case: break it one way, and name the phrase the scan must say. */
const CASES = [
  {
    name: 'the entry cap goes back to counting iterations',
    mutate: (d) => edit(d, 'worker/worker.js',
      'let n = Object.keys(out).length;', 'let budget = MAX_ENTRIES;'),
    expect: /MAX_ENTRIES must cap the RESULT map|does not measure the result map/,
  },
  {
    name: 'the round-trip size guard is removed',
    mutate: (d) => edit(d, 'worker/worker.js',
      'if (afterWire > MAX_BODY && afterWire > beforeWire) {',
      'if (false) {'),
    expect: /does not price what the client must send back against MAX_BODY/,
  },
  {
    /* The defect a review found in the guard itself: `plan` is ~77 KB and the
       client never sends it, so charging it against a request-body limit refuses
       writes whose real round trip fits easily. */
    name: 'the size guard starts charging the plan against the body limit',
    mutate: (d) => edit(d, 'worker/worker.js',
      '  ticks: s.ticks, extras: s.extras, pantry: s.pantry, log: s.log, dishes: s.dishes,',
      '  ticks: s.ticks, extras: s.extras, pantry: s.pantry, log: s.log, dishes: s.dishes, plan: s.plan,'),
    expect: /syncedWire\(\) includes plan/,
  },
  {
    name: 'the size guard stops measuring one of the synced maps',
    mutate: (d) => edit(d, 'worker/worker.js',
      '  ticks: s.ticks, extras: s.extras, pantry: s.pantry, log: s.log, dishes: s.dishes,',
      '  ticks: s.ticks, extras: s.extras, pantry: s.pantry, log: s.log,'),
    expect: /syncedWire\(\) does not include dishes/,
  },
  {
    name: 'prune() loses the pantry loop',
    mutate: (d) => edit(d, 'worker/worker.js',
      'for (const [k, v] of Object.entries(state.pantry || {})) {',
      'for (const [k, v] of Object.entries({})) { const _unused = state.pantry;'),
    expect: /prune\(\) never looks at state\.pantry/,
  },
  {
    name: 'prune() loses the ticks loop',
    mutate: (d) => edit(d, 'worker/worker.js',
      'for (const [k, v] of Object.entries(state.ticks)) {',
      'for (const [k, v] of Object.entries({})) {'),
    expect: /prune\(\) never looks at state\.ticks/,
  },
  {
    name: 'a month is hardcoded in the Worker again',
    mutate: (d) => edit(d, 'worker/worker.js',
      'const ym = blockYM(plan);\n  const tYM',
      "const ym = '2026-08';\n  const tYM"),
    expect: /hardcodes 1 calendar date/,
  },
  {
    /* The ACTUAL shape of the original defect: a template literal whose closing
       delimiter is an interpolation, not a quote. The first version of this check
       missed exactly this. */
    name: 'the August stamp comes back as a template literal',
    mutate: (d) => edit(d, 'worker/worker.js',
      '    date: dateISO,',
      "    date: `2026-08-${String(dayNum).padStart(2, '0')}`,"),
    expect: /hardcodes \d+ calendar date/,
  },
  {
    name: 'blockYM() is deleted',
    mutate: (d) => edit(d, 'worker/worker.js', 'function blockYM(plan) {', 'function blockYMx(plan) {'),
    expect: /has no blockYM\(\)/,
  },
  {
    name: 'the fitness window becomes client-steerable again',
    mutate: (d) => edit(d, 'worker/worker.js', 'const FORM_DAYS = 180;', 'const FORM_DAYSX = 180;'),
    expect: /no FORM_DAYS constant/,
  },
  {
    name: 'CTL is seeded at zero again',
    mutate: (d) => edit(d, 'worker/worker.js',
      'let ctl = seed, atl = seed;', 'let ctl = 0, atl = 0;'),
    expect: /seeds CTL\/ATL at zero again/,
  },
  {
    name: 'the ride cache is taken out of fetchRides',
    mutate: (d) => edit(d, 'worker/worker.js', '  const cache = caches.default;', '  const cache = { match: async () => undefined, put: async () => {} };'),
    expect: /fetchRides\(\) does not use caches\.default/,
  },
  {
    name: 'a cache hit is served by spreading the stored headers',
    mutate: (d) => edit(d, 'worker/worker.js',
      '      return json(await fetchRides(env, oldest, newest, ctx), 200, origin);',
      '      const hit = await caches.default.match(new Request("https://rides.local/x"));\n' +
      '      if (hit) return new Response(hit.body, { headers: { ...Object.fromEntries(hit.headers) } });\n' +
      '      return json(await fetchRides(env, oldest, newest, ctx), 200, origin);'),
    expect: /spreading a cached copy's headers/,
  },
  {
    name: "a day's meals stop summing to its own total",
    mutate: (d) => {
      const p = join(d, 'plan.json');
      const j = JSON.parse(readFileSync(p, 'utf8'));
      j.plan.days[4].kc += 120;
      writeFileSync(p, JSON.stringify(j));
    },
    expect: /meals sum to \d+ kcal but the day says/,
  },
  {
    name: 'a paid route loses its budget gate',
    mutate: (d) => edit(d, 'worker/worker.js',
      '      const budget = await listStub(env).spend();\n      if (!budget.ok) return json({ ok: false, why: `daily limit reached (${COACH_MAX_DAY})` }, 429, origin);\n\n      /* Fetch the fixed form window',
      '      const budget = { ok: true, n: 0 };\n\n      /* Fetch the fixed form window'),
    expect: /route \/analyze calls askModel\(\) without/,
  },
  {
    name: '/food loses its separate lookup ceiling',
    mutate: (d) => edit(d, 'worker/worker.js',
      '  const gate = await stub.foodBudget(', '  const gate = { ok: true }; const _skip = ('),
    expect: /lookupFood\(\) has no foodBudget\(\) gate/,
  },
  {
    name: 'a runtime dependency is added to package.json',
    mutate: (d) => {
      const p = join(d, 'package.json');
      const j = JSON.parse(readFileSync(p, 'utf8'));
      j.dependencies = { 'left-pad': '1.3.0' };
      writeFileSync(p, JSON.stringify(j, null, 2));
    },
    expect: /declares runtime dependencies/,
  },
  {
    name: 'a package in the lockfile stops being dev-only',
    mutate: (d) => {
      const p = join(d, 'package-lock.json');
      const j = JSON.parse(readFileSync(p, 'utf8'));
      delete j.packages['node_modules/undici'].dev;
      writeFileSync(p, JSON.stringify(j, null, 2));
    },
    expect: /non-dev package\(s\).*undici/,
  },
  {
    name: 'the wrangler pin is loosened to a range',
    mutate: (d) => {
      const p = join(d, 'package.json');
      const j = JSON.parse(readFileSync(p, 'utf8'));
      j.devDependencies.wrangler = '^4.122.0';
      writeFileSync(p, JSON.stringify(j, null, 2));
    },
    expect: /rather than an exact version/,
    warnOnly: true,
  },
  {
    /* Now an err() rather than a warn(), because the two copies agree. */
    name: 'plan.json drifts from the BUNDLED copy again',
    mutate: (d) => {
      const p = join(d, 'plan.json');
      const j = JSON.parse(readFileSync(p, 'utf8'));
      j.plan.days[0].kc += 86;                    // the bacon, removed from one copy only
      writeFileSync(p, JSON.stringify(j));
    },
    expect: /plan\.json and index\.html BUNDLED have drifted/,
  },
  {
    /* The false clear the audit found: an overstated ft must never be able to
       answer the low-fat question. */
    name: 'macroRow goes back to gating the low-fat warning on ft alone',
    mutate: (d) => edit(d, 'web/public/index.html',
      'const fatLow = reconciles && (9 * ft) / sum.kc < 0.20;',
      'const fatLow = (9 * ft) / sum.kc < 0.20;'),
    expect: /no longer gates the low-fat warning on whether pr\/ft reconcile/,
  },
  {
    name: 'the esc() escaper is weakened (pre-existing control)',
    mutate: (d) => edit(d, 'web/public/index.html',
      "const esc = s => String(s).replace(/[&<>\"']/g,", "const esc = s => String(s).replace(/[&<>]/g,"),
    expect: /esc\(\) escaper has been modified/,
  },
];

/* Sanity: an unmutated copy must pass, or every result below is meaningless. */
const clean = freshCopy();
const base = runScan(clean);
console.log(`\nbaseline (no mutation): exit ${base.code}`);
if (base.code !== 0) {
  console.log(base.out);
  console.log('BASELINE IS NOT CLEAN — aborting, the results would mean nothing');
  process.exit(1);
}
console.log('  ok   an untouched copy of the repo passes\n');

let caught = 0, missed = 0;
for (const c of CASES) {
  const dir = freshCopy();
  try {
    c.mutate(dir);
  } catch (e) {
    console.log(`  SKIP ${c.name} — ${e.message}`);
    missed++;
    continue;
  }
  const r = runScan(dir);
  const said = c.expect.test(r.out);
  /* A warn() is reported without failing the build, on purpose — it must still
     be SAID, but the exit code stays 0 so pre-commit is not blocked. */
  const wanted = c.warnOnly ? r.code === 0 : r.code !== 0;
  if (wanted && said) {
    caught++;
    console.log(`  ok   ${c.warnOnly ? 'warned about' : 'caught'}: ${c.name}`);
  } else if (said) {
    missed++;
    console.log(`  FAIL said the right thing but at the wrong severity: ${c.name}`);
    console.log(`       expected exit ${c.warnOnly ? '0 (warn)' : 'non-zero (err)'}, got ${r.code}`);
  } else if (r.code !== 0) {
    missed++;
    console.log(`  FAIL failed, but for the wrong reason: ${c.name}`);
    console.log(`       wanted ${c.expect} — got:\n       ${r.out.trim().split('\n').join('\n       ')}`);
  } else {
    missed++;
    console.log(`  FAIL NOT CAUGHT: ${c.name}`);
  }
}

console.log(`\n${caught} regressions caught, ${missed} missed, of ${CASES.length}`);
process.exit(missed ? 1 : 0);
