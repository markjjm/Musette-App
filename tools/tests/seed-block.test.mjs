/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* A new account has no block to carry forward, so the first month is built from
   what the intake asked. The danger here is specific and was caught by testing
   a real archetype rather than by reasoning: the seed block is a CYCLIST's
   month whose lightest day is 2,154 kcal, and a 52-year-old woman walking three
   times a week needs about 1,675. Nearest-match handed her 370 kcal a day too
   much - for somebody who said they wanted to lose weight, exactly backwards. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { loadWorker } from './load-worker.mjs';

const { seedBlock, validatePlan, restingEnergy, parseIngredient, scaleDay } =
  await loadWorker(['seedBlock', 'validatePlan', 'restingEnergy', 'parseIngredient', 'scaleDay']);
const seed = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8')).plan;

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

const PEOPLE = [
  ['a walker who wants to be healthier', { sport: 'walking', level: 'starting', days: ['Mon', 'Wed', 'Sat'],
    profile: { weight_lb: 210, height_in: 68, age: 52, sex: 'female', goal: 'lose' } }],
  ['a runner a few times a week', { sport: 'running', level: 'regular', days: ['Tue', 'Thu', 'Sun'], longDay: 'Sun',
    profile: { weight_lb: 160, height_in: 70, age: 34, sex: 'male', goal: 'hold' } }],
  ['a cyclist training for something', { sport: 'cycling', level: 'athlete', days: ['Tue', 'Wed', 'Thu', 'Sat', 'Sun'], longDay: 'Sat',
    profile: { weight_lb: 148, height_in: 70, age: 40, sex: 'male', goal: 'hold' } }],
  ['somebody lifting, wanting to gain', { sport: 'gym', level: 'regular', days: ['Mon', 'Tue', 'Thu', 'Fri'],
    profile: { weight_lb: 175, height_in: 73, age: 27, sex: 'male', goal: 'gain' } }],
];

console.log('\n1. Every kind of person gets a plan the Worker would accept');
for (const [who, opts] of PEOPLE) {
  const r = seedBlock(seed, '2026-09', opts);
  const v = validatePlan(r.plan);
  ok(r.ok && v === null, `${who}: ${v === null ? 'clean' : v}`);
}

console.log('\n2. And it actually fits them');
/* The bug this exists to stop: being handed somebody else\'s calorie needs. */
for (const [who, opts] of PEOPLE) {
  const r = seedBlock(seed, '2026-09', opts);
  ok(r.basis.mean_target_gap_kcal < 150,
    `${who}: average ${r.basis.mean_target_gap_kcal} kcal from target (was 372 for the walker before scaling)`);
}

console.log('\n3. Scaling never breaks the sums');
for (const [who, opts] of PEOPLE) {
  const r = seedBlock(seed, '2026-09', opts);
  const bad = r.plan.days.filter((d) => d.meals.reduce((a, m) => a + m.kc, 0) !== d.kc
    || d.meals.reduce((a, m) => a + m.cb, 0) !== d.cb);
  ok(bad.length === 0, `${who}: every day still adds up (${bad.length} bad)`);
}

console.log('\n4. A scaled portion says the smaller number, not the original');
/* The dishonesty to avoid: the label reading "3/4 cup" while the kcal is half. */
const walker = seedBlock(seed, '2026-09', PEOPLE[0][1]);
const scaled = walker.plan.days.find((d) => d.scaled);
ok(!!scaled, `some days were scaled for the walker (x${scaled ? scaled.scaled : '-'})`);
const src = seed.days.find((d) => d.d === scaled.from);
const before = parseIngredient(src.meals[0].i[0].n);
const after = parseIngredient(scaled.meals[0].i[0].n);
ok(before && after && after.qty < before.qty,
  `the first ingredient shrank with the day: ${before.qty} -> ${after.qty} ${after.unit}`);
ok(after.name === before.name && after.unit === before.unit, 'and it is still the same food in the same unit');

console.log('\n5. Nobody is handed a half or a double of somebody else\'s day');
const tiny = seedBlock(seed, '2026-09', { sport: 'walking', level: 'starting', days: ['Sat'],
  profile: { weight_lb: 95, height_in: 58, age: 70, sex: 'female', goal: 'lose' } });
const factors = tiny.plan.days.filter((d) => d.scaled).map((d) => d.scaled);
ok(factors.every((f) => f >= 0.6 && f <= 1.6), `scaling is clamped (range ${Math.min(...factors)}-${Math.max(...factors)})`);

console.log('\n6. Resting energy is the standard formula, not a guess');
/* Mifflin-St Jeor, checked against a worked example. */
const r70 = restingEnergy({ weight_lb: 154, height_in: 70, age: 30, sex: 'male' });
ok(Math.abs(r70 - 1666) < 25, `70 kg, 178 cm, 30, male -> ${r70} kcal (textbook ~1,666)`);
const rf = restingEnergy({ weight_lb: 154, height_in: 70, age: 30, sex: 'female' });
ok(rf < r70, `and the female figure is lower (${rf} vs ${r70})`);

console.log('\n7. A walker gets walking hours, not a cyclist\'s');
const w = seedBlock(seed, '2026-09', PEOPLE[0][1]);
const c = seedBlock(seed, '2026-09', PEOPLE[2][1]);
ok(w.basis.total_hours < c.basis.total_hours / 3,
  `walker ${w.basis.total_hours}h vs cyclist ${c.basis.total_hours}h in the month`);
ok(w.plan.training.filter((t) => t.h > 0).every((t) => ['Mon', 'Wed', 'Sat'].includes(t.wd)),
  'and only on the days they said they could train');

console.log('\n8. Every seeded month comes with a shopping list');
for (const [who, opts] of PEOPLE) {
  const r = seedBlock(seed, '2026-09', opts);
  ok(r.basis.shopping_lines > 50, `${who}: ${r.basis.shopping_lines} shopping lines`);
}

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
