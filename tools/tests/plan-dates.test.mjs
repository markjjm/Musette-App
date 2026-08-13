/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Prove the August hardcode is gone, using the real plan.json and the real
   worker functions. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { readFileSync } from 'node:fs';
import { loadWorker } from './load-worker.mjs';

const { coachFacts, trainingStats, blockYM } =
  await loadWorker(['coachFacts', 'trainingStats', 'blockYM']);

const plan = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8')).plan;
const state = { plan, log: {} };

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. blockYM parses the plan label the front end already parses');
ok(blockYM(plan) === '2026-08', `blockYM -> ${blockYM(plan)}`);
ok(blockYM({ block: 'September 2026' }) === '2026-09', 'September 2026 -> 2026-09');
ok(blockYM({}) === null, 'no block label -> null (callers fall back to old behaviour)');

console.log('\n2. A date inside the block still works, and is stamped honestly');
const aug13 = coachFacts(state, [], '2026-08-13', 12 * 60);
ok(aug13 !== null, 'coachFacts answers for 2026-08-13');
ok(aug13.date === '2026-08-13', `date is the real date, not a rebuilt one -> ${aug13.date}`);
ok(aug13.weekday === plan.days.find((d) => d.d === 13).wd, `weekday matches plan day 13 (${aug13.weekday})`);

console.log('\n3. The bug: a September date must NOT alias onto August');
const sep1 = coachFacts(state, [], '2026-09-01', 12 * 60);
const augD1 = plan.days.find((d) => d.d === 1);
ok(sep1 === null, 'coachFacts returns null for 2026-09-01 (/coach answers 404, not day 1)');
console.log(`   for reference, what it used to serve: ${augD1.kind}, ${augD1.kc} kcal, ${augD1.cb} g carb, stamped 2026-08-01`);

const sep15 = coachFacts(state, [], '2026-09-15', 12 * 60);
ok(sep15 === null, 'and null for 2026-09-15');
const jul31 = coachFacts(state, [], '2026-07-31', 12 * 60);
ok(jul31 === null, 'and null for a date BEFORE the block too');

console.log('\n4. Adherence: both sides must come from the same window');
/* Build one real ride per training day that has hours, so "actual" is knowable. */
const rides = [];
for (const t of plan.training) {
  if ((t.h || 0) > 0) {
    rides.push({
      date: `2026-08-${String(t.d).padStart(2, '0')}`,
      secs: Math.round(t.h * 3600), kcal: Math.round(t.h * 600), load: Math.round(t.h * 60),
      watts: 180, hr: 140, trust: 'measured',
    });
  }
}
const totalPlanned = plan.training.reduce((a, t) => a + ((t.h || 0) > 0 ? t.h : 0), 0);
console.log(`   the block plans ${Math.round(totalPlanned * 10) / 10} h across ${rides.length} ride days`);

const midBlock = trainingStats(rides, plan, '2026-08-13');
console.log(`   on 2026-08-13: planned ${midBlock.block_planned_hours} h / actual ${midBlock.block_actual_hours} h`);
ok(
  Math.abs(midBlock.block_planned_hours - midBlock.block_actual_hours) < 0.15,
  'mid-block, planned and actual agree when every ride was done as planned'
);

const afterBlock = trainingStats(rides, plan, '2026-09-05');
console.log(`   on 2026-09-05: planned ${afterBlock.block_planned_hours} h / actual ${afterBlock.block_actual_hours} h`);
ok(
  Math.abs(afterBlock.block_planned_hours - afterBlock.block_actual_hours) < 0.15,
  'after the block, BOTH sides count the whole block (was 5.0 h vs ~38 h)'
);
ok(
  Math.abs(afterBlock.block_planned_hours - totalPlanned) < 0.15,
  `and the planned side is the whole block (${afterBlock.block_planned_hours} vs ${Math.round(totalPlanned * 10) / 10})`
);
ok(afterBlock.block_actual_ride_days === rides.length, `actual ride days ${afterBlock.block_actual_ride_days} = ${rides.length}`);

const beforeBlock = trainingStats(rides, plan, '2026-07-20');
console.log(`   on 2026-07-20: planned ${beforeBlock.block_planned_hours} h / actual ${beforeBlock.block_actual_hours} h`);
ok(
  beforeBlock.block_planned_hours === 0 && beforeBlock.block_actual_hours === 0,
  'before the block starts, neither side counts anything'
);

console.log('\n5. The ratio ANALYST_SYSTEM keys its rule on');
const ratio = (s) => (s.block_planned_hours ? s.block_actual_hours / s.block_planned_hours : null);
console.log(`   mid-block ${ratio(midBlock).toFixed(2)}, after ${ratio(afterBlock).toFixed(2)} — 1.00 means adherent`);
ok(Math.abs(ratio(afterBlock) - 1) < 0.02, 'a rider who did exactly the plan reads as adherent, not over-fed');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
