/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Generating a month is where a language model would be most tempting and most
   dangerous: scan.mjs and validatePlan both refuse a plan whose meals do not sum
   exactly to their day's totals, and that is 31 days of exact addition. So days
   are REUSED from the previous block rather than written, and these tests hold
   that line - the arithmetic must be exact by construction, not by repair. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { loadWorker } from './load-worker.mjs';

const { generateBlock, validatePlan } = await loadWorker(['generateBlock', 'validatePlan']);
const prev = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8')).plan;

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. A generated month is a plan the Worker would accept');
const sep = generateBlock(prev, '2026-09', {});
ok(sep.ok, 'September generates');
ok(validatePlan(sep.plan) === null, `and passes the same validator PUT /plan uses (${validatePlan(sep.plan) || 'clean'})`);
ok(sep.plan.block === 'September 2026', `block is named for the month (${sep.plan.block})`);
ok(sep.plan.days.length === 30, `September has 30 days (${sep.plan.days.length})`);

console.log('\n2. Every day adds up, by construction');
/* The property the whole design exists to guarantee. */
const off = sep.plan.days.filter((d) => d.meals.reduce((a, m) => a + m.kc, 0) !== d.kc
  || d.meals.reduce((a, m) => a + m.cb, 0) !== d.cb);
ok(off.length === 0, `no day's meals disagree with its own totals (${off.length} bad)`);

console.log('\n3. Month lengths are real, not assumed 30 or 31');
for (const [ym, n] of [['2026-09', 30], ['2026-10', 31], ['2027-02', 28], ['2028-02', 29]]) {
  const g = generateBlock(prev, ym, {});
  ok(g.ok && g.plan.days.length === n && g.plan.training.length === n,
    `${ym} has ${n} days (${g.plan.days.length}) - leap years included`);
}

console.log('\n4. The training ramps, and recovers');
const hoursByWeek = {};
for (const t of sep.plan.training) {
  const w = t.wk;
  hoursByWeek[w] = (hoursByWeek[w] || 0) + t.h;
}
const wk = Object.entries(hoursByWeek).sort();
console.log('   ' + wk.map(([w, h]) => `${w}:${h.toFixed(1)}h`).join('  '));
ok(wk[1][1] > wk[0][1], 'week 2 is heavier than week 1');
const recovery = wk[3][1];
ok(recovery < wk[2][1] * 0.85, `week 4 is a genuine recovery week (${recovery.toFixed(1)}h vs ${wk[2][1].toFixed(1)}h)`);

console.log('\n5. Targets are fitted to the rider, not hardcoded');
ok(sep.basis.targets_fitted === true, `fitted from the block being carried forward (${sep.basis.kcal_model})`);
/* A day with no riding must not be handed a long-ride target. */
const rest = sep.plan.training.filter((t) => t.h === 0);
const restKc = rest.map((t) => t.kc);
ok(restKc.every((k) => k < 2500), `rest days target around ${restKc[0]} kcal, not a ride day's`);
const longest = sep.plan.training.slice().sort((a, b) => b.h - a.h)[0];
ok(longest.kc > 3500, `the longest day (${longest.h}h) targets ${longest.kc} kcal`);

console.log('\n6. Nothing is invented: every day came from a real one');
ok(sep.plan.days.every((d) => Number.isInteger(d.from)), 'each day records which day it was carried from');
const distinct = new Set(sep.plan.days.map((d) => d.from)).size;
ok(distinct >= 5, `and they are spread across ${distinct} different source days rather than repeating one`);

console.log('\n7. Rubbish in is refused, not guessed at');
ok(generateBlock(prev, 'next month', {}).ok === false, 'a month that is not YYYY-MM is refused');
ok(generateBlock({ days: [] }, '2026-09', {}).ok === false, 'a block with no days to carry forward is refused');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
