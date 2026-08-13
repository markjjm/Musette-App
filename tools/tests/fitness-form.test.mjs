/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Prove the form numbers are measurements now: warm-started, and not steerable
   by the caller. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { loadWorker } from './load-worker.mjs';

const { trainingForm, trainingStats, FORM_DAYS } =
  await loadWorker(['trainingForm', 'trainingStats', 'FORM_DAYS']);

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

const TODAY = '2026-08-13';
const back = (n) => {
  const d = new Date(TODAY + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
/* One ride a day of the given load, for n days up to today. */
const steady = (n, load) =>
  Array.from({ length: n }, (_, i) => ({ date: back(n - 1 - i), secs: 3600, kcal: 600, load }));

console.log(`\nFORM_DAYS = ${FORM_DAYS}`);

console.log('\n1. Dead-constant load: truth is fitness 60, fatigue 60, form 0');
const f = trainingForm(steady(FORM_DAYS, 60), TODAY, back(FORM_DAYS - 1));
console.log(`   fitness ${f.fitness_ctl}  fatigue ${f.fatigue_atl}  form ${f.form_tsb}  ramp ${f.ctl_change_this_week}`);
console.log('   before the fix, a 42-day window gave 37.4 / 59.8 / -22.4 and a +4.1/wk build');
ok(Math.abs(f.fitness_ctl - 60) < 0.5, `fitness is 60, not 37.4 (${f.fitness_ctl})`);
ok(Math.abs(f.fatigue_atl - 60) < 0.5, `fatigue is 60 (${f.fatigue_atl})`);
ok(Math.abs(f.form_tsb) < 0.5, `form is 0, not -22.4 (${f.form_tsb})`);
ok(Math.abs(f.ctl_change_this_week) < 0.5, `no fabricated ramp on constant load (${f.ctl_change_this_week})`);
ok(f.settled === true, 'reported as settled');

console.log('\n2. A short history must say so rather than read as buried');
const short = trainingForm(steady(30, 60), TODAY, back(29));
console.log(`   30 days: form ${short.form_tsb}, settled ${short.settled}`);
ok(short.settled === false, 'settled is false on 30 days of history');
ok(/provisional/.test(short.confidence_note), 'the note tells the model not to advise on it');

console.log('\n3. A genuine taper must read as fresh, not tired');
/* 150 days at 70, then 14 days at 20: real form should be strongly positive. */
const taper = [...steady(FORM_DAYS, 70).slice(0, FORM_DAYS - 14),
               ...Array.from({ length: 14 }, (_, i) => ({ date: back(13 - i), secs: 1800, kcal: 300, load: 20 }))];
const t = trainingForm(taper, TODAY, back(FORM_DAYS - 1));
console.log(`   fitness ${t.fitness_ctl}  fatigue ${t.fatigue_atl}  form ${t.form_tsb}`);
ok(t.form_tsb > 15, `a tapered rider reads clearly fresh (+${t.form_tsb}), not -2.3`);
ok(t.fatigue_atl < t.fitness_ctl, 'fatigue has dropped below fitness, which is what a taper is');

console.log('\n4. A real build must still show a real ramp');
const build = Array.from({ length: FORM_DAYS }, (_, i) => ({
  date: back(FORM_DAYS - 1 - i), secs: 3600, kcal: 600, load: 30 + (i * 40 / FORM_DAYS),
}));
const b = trainingForm(build, TODAY, back(FORM_DAYS - 1));
console.log(`   fitness ${b.fitness_ctl}  ramp ${b.ctl_change_this_week}/wk`);
ok(b.ctl_change_this_week > 0.3, `a rising load still reports a positive ramp (${b.ctl_change_this_week})`);
ok(b.ctl_change_this_week < 7, 'and it is not the fabricated injury-threshold figure');

console.log('\n5. The caller must not be able to steer it (the ?weeks= hole)');
const rides = steady(FORM_DAYS, 60);
const formStart = back(FORM_DAYS - 1);
const table = (weeks) => rides.filter((r) => r.date >= back(weeks * 7));
const s2 = trainingStats(table(2), null, TODAY, rides, formStart);
const s6 = trainingStats(table(6), null, TODAY, rides, formStart);
const s12 = trainingStats(table(12), null, TODAY, rides, formStart);
console.log(`   weeks=2  form ${s2.form.form_tsb}   weeks=6  form ${s6.form.form_tsb}   weeks=12 form ${s12.form.form_tsb}`);
console.log('   before the fix these were -34.9, -22.4 and roughly -13 for the same rider');
ok(
  s2.form.form_tsb === s6.form.form_tsb && s6.form.form_tsb === s12.form.form_tsb,
  'form is identical whatever ?weeks= asks for'
);
ok(
  s2.weeks.length < s12.weeks.length,
  `?weeks= still controls the table it is meant to (${s2.weeks.length} vs ${s12.weeks.length} weeks listed)`
);

console.log('\n5b. ?weeks= must not move BLOCK ADHERENCE either');
/* The bug this catches: the month gate fixed the planned side but left the actual
   side filtered out of the caller's table window, so ?weeks=2 made a perfectly
   adherent rider look like they had ridden a fortnight of a month's plan. The
   original defect, wearing an argument instead of a hardcoded month. */
const PLAN = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8')).plan;
const blockRides = [];
for (const t of PLAN.training) {
  if ((t.h || 0) > 0) {
    blockRides.push({
      date: `2026-08-${String(t.d).padStart(2, '0')}`,
      secs: Math.round(t.h * 3600), kcal: Math.round(t.h * 600), load: Math.round(t.h * 60),
      watts: 180, hr: 140, trust: 'measured',
    });
  }
}
const AFTER = '2026-09-05';                       // the whole block is behind us
const slice = (weeks) => {
  const d = new Date(AFTER + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  const from = d.toISOString().slice(0, 10);
  return blockRides.filter((r) => r.date >= from);
};
const adh = (weeks) => trainingStats(slice(weeks), PLAN, AFTER, blockRides, '2026-03-01');
const a2 = adh(2), a6 = adh(6), a12 = adh(12);
console.log(`   weeks=2  ${a2.block_actual_hours}h actual / ${a2.block_planned_hours}h planned`);
console.log(`   weeks=6  ${a6.block_actual_hours}h actual / ${a6.block_planned_hours}h planned`);
console.log(`   weeks=12 ${a12.block_actual_hours}h actual / ${a12.block_planned_hours}h planned`);
ok(
  a2.block_actual_hours === a6.block_actual_hours && a6.block_actual_hours === a12.block_actual_hours,
  'actual block hours are identical whatever ?weeks= asks for'
);
ok(
  Math.abs(a2.block_actual_hours - a2.block_planned_hours) < 0.15,
  'an adherent rider reads as adherent on weeks=2, not as having ridden a fortnight'
);
ok(a2.block_actual_ride_days === a12.block_actual_ride_days, 'and the ride-day count does not move either');

console.log('\n5c. No parseable plan.block means "cannot tell", not "rode nothing"');
const noBlock = trainingStats(blockRides, { ...PLAN, block: 'not a month' }, AFTER, blockRides, '2026-03-01');
console.log(`   planned ${noBlock.block_planned_hours} / actual ${noBlock.block_actual_hours}`);
ok(noBlock.block_actual_hours === null, 'actual hours are null, not 0');
ok(noBlock.block_planned_hours === null, 'planned hours are null too, so no ratio can be formed');
ok(/do not comment on adherence/.test(noBlock.block_adherence_note || ''), 'and the model is told why');

console.log('\n6. A rider whose first ride is recent must not get a cold reading');
/* Nothing for 150 days, then two weeks of riding. The old code started the series
   at the first ride, so the window length made no difference at all. */
const returning = Array.from({ length: 14 }, (_, i) => ({ date: back(13 - i), secs: 3600, kcal: 600, load: 60 }));
const r = trainingForm(returning, TODAY, formStart);
console.log(`   days_counted ${r.days_counted} (window is ${FORM_DAYS}), settled ${r.settled}`);
ok(r.days_counted > 150, 'the series spans the window, not just the days with rides');
ok(r.settled === true, 'and it is honest that the window is long enough');
ok(r.form_tsb < 0, `genuinely building from rest reads as negative form (${r.form_tsb}), which is true here`);

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
