/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* setPlan used to store whatever it was handed. With a model writing plans that
   is the gap between generated output and stored nutrition data, so PUT /plan
   now validates - and the check that matters most is arithmetic: a month whose
   days do not add up must be refused at the write, not just in the repo. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { loadWorker } from './load-worker.mjs';

const { validatePlan } = await loadWorker(['validatePlan']);
const real = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8')).plan;
const clone = () => JSON.parse(JSON.stringify(real));

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. The plan this repo actually ships must pass');
/* If this ever fails the validator is wrong, not the plan. */
const verdict = validatePlan(real);
ok(verdict === null, `the real August block validates (${verdict === null ? 'clean' : verdict})`);

console.log('\n2. A day that does not add up is refused');
const bad = clone();
bad.days[0].meals[0].kc += 50;
ok(/day \d+: meals sum to \d+ kcal but the day says/.test(validatePlan(bad) || ''),
  `50 kcal added to one meal is caught: ${validatePlan(bad)}`);
const badCb = clone();
badCb.days[2].meals[1].cb += 7;
ok(/g carb but the day says/.test(validatePlan(badCb) || ''), 'and the same for carbohydrate');

console.log('\n3. The shapes a generated month could plausibly get wrong');
const cases = [
  ['no weeks',            (p) => { p.weeks = []; },                          /weeks must be/],
  ['a 32nd day',          (p) => { p.days[0].d = 32; },                      /day number 1-31/],
  ['a duplicated day',    (p) => { p.days[1].d = p.days[0].d; },             /appears twice/],
  ['a 9000 kcal day',     (p) => { p.days[0].kc = 9000; },                   /kc must be a whole number/],
  ['a fractional day kc', (p) => { p.days[0].kc = 2195.5; },                 /kc must be a whole number/],
  ['an unknown store',    (p) => { p.weeks[1].lists.Z = []; },               /unknown store/],
  ['a novel-length item', (p) => { p.weeks[1].lists.A[0].items[0].n = 'x'.repeat(500); }, /item name missing or too long/],
  ['a negative cost',     (p) => { p.weeks[1].lists.A[0].items[0].c = -5; }, /item cost out of range/],
  ['a 40-meal day',       (p) => { p.days[0].meals = Array(40).fill({ kc: 1, cb: 1 }); }, /at most \d+ meals/],
  ['training of 99 h',    (p) => { p.training[0].h = 99; },                  /hours must be 0-24/],
  ['a missing block',     (p) => { delete p.block; },                        /block must be a string/],
];
for (const [name, mutate, expect] of cases) {
  const p = clone(); mutate(p);
  const got = validatePlan(p);
  ok(got !== null && expect.test(got), `${name} -> ${got === null ? 'ACCEPTED (bug)' : got}`);
}

console.log('\n4. Optional parts stay optional');
/* publish-plan.py has sent plans without days[] or training[] before now, and
   the pantry week legitimately carries an empty days array. */
const thin = { block: 'September 2026', weeks: [{ id: 'w1', label: 'Week 1', days: [], lists: { A: [] } }] };
ok(validatePlan(thin) === null, 'a plan with no days[] and no training[] is still a plan');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
