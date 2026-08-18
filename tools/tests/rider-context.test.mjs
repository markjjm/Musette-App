/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* cleanProfile() clamped and stored a profile from the day it existed, the app
   synced it, and NOTHING read it: every prompt said "67.1 kg, riding to hold
   weight steady" as a literal. A rider who changed weight, switched to losing,
   or entered an FTP was still advised as a 67.1 kg rider holding steady. */
import { loadWorker } from './load-worker.mjs';
const { riderNow, riderLine, weightTrend } = await loadWorker(['riderNow', 'riderLine', 'weightTrend']);

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. The rider is whoever the profile says, not 67.1 kg');
const heavier = riderNow({ weight_lb: 176, height_in: 72, age: 45, goal: 'lose', rate_lb_wk: 1, hours_wk: 11, ftp: 260 });
ok(heavier.kg === 79.8, `176 lb reads as ${heavier.kg} kg, not 67.1`);
ok(/losing weight/.test(heavier.goal), `a goal of lose says so: "${heavier.goal}"`);
ok(heavier.target_rate_lb_wk === 1, 'and carries the rate that goal is aiming at');
ok(riderLine({ weight_lb: 176, age: 45, goal: 'lose', ftp: 260 }).indexOf('67.1') < 0,
  'the system prompt line no longer contains the old constant');

console.log('\n2. Power-to-weight, but only when the power is real');
ok(heavier.ftp_w === 260 && heavier.w_per_kg === 3.26, `260 W at 79.8 kg is ${heavier.w_per_kg} W/kg`);
const noFtp = riderNow({ weight_lb: 148, ftp: 0 });
ok(noFtp.w_per_kg === undefined && noFtp.ftp_w === undefined,
  'an unentered FTP is absent, not 0 W/kg - which would read as a measurement');

console.log('\n3. No profile behaves exactly as before');
/* An account that has never opened the profile screen must still get advice. */
const none = riderNow(null);
ok(none.kg === 67.1, `an empty profile is still the rider this was built for (${none.kg} kg)`);
ok(/holding weight steady/.test(none.goal), 'and the goal it always assumed');

console.log('\n4. Things the rider said, carried to the model');
const fussy = riderNow({ weight_lb: 148, avoid: 'no shellfish, no coriander', notes: 'cooks on a single hob' });
ok(fussy.will_not_eat === 'no shellfish, no coriander', 'what they will not eat travels with the request');
ok(fussy.rider_notes === 'cooks on a single hob', 'and so do their own notes');

console.log('\n5. A weight trend is a slope, and it says when it cannot see one');
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const thin = { [day(3)]: { w: 176 }, [day(1)]: { w: 175 } };
ok(weightTrend(thin, 180).settled === false, 'two weigh-ins three days apart is not a trend');
ok(weightTrend({}, 180).points === 0, 'and no weigh-ins says so rather than inventing zero');

/* Eight weeks of a real, slow cut: 176 lb down to 168. */
const losing = {};
for (let i = 56; i >= 0; i -= 4) losing[day(i)] = { w: Math.round((168 + (i / 56) * 8) * 10) / 10 };
const t = weightTrend(losing, 180);
ok(t.settled === true, `eight weeks of weigh-ins is enough to read (${t.points} points over ${t.span_days} days)`);
ok(t.change_lb === -8, `it sees the whole change (${t.change_lb} lb)`);
ok(t.rate_lb_wk < -0.9 && t.rate_lb_wk > -1.1, `and the weekly rate (${t.rate_lb_wk} lb/wk)`);

console.log('\n6. The window is honoured');
const old = { '2019-01-01': { w: 200 }, ...losing };
ok(weightTrend(old, 180).first_lb === 176, 'a 2019 weigh-in is outside a 180-day window and is not in the slope');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
