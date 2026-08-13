/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Food eaten on top of the plan. The log had no way to say "and also": a swap
   REPLACES a meal, so two pancakes on a morning you also ate your snack could
   only be recorded by throwing the snack away. These check that an extra counts
   towards the day, that it cannot collide with a planned meal's key, and that
   dialling it to zero removes it. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(join(ROOT, 'web/public/index.html'), 'utf8');

function grab(decl) {
  const i = html.indexOf(decl);
  if (i < 0) throw new Error(`not found: ${decl}`);
  let d = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}' && --d === 0) break;
  }
  return html.slice(i, j + 1);
}
const pick = (re) => (re.exec(html) || (() => { throw new Error(`not found: ${re}`); })())[0];

const mod = await import('data:text/javascript,' + encodeURIComponent(`
let mealLog = {};
const now = () => Date.now();
${pick(/const uid = .*;/)}
${pick(/const logKey = .*;/)}
${pick(/const ateOf\s+= .*;/)}
${pick(/const EXTRA_MARK = .*;/)}
${pick(/const extraKey = .*;/)}
${grab('function extrasOf(')}
${grab('function ateGot(')}
${grab('function carbAdherence(')}
export const api = {
  extrasOf, ateGot, carbAdherence, extraKey, logKey,
  set: (l) => { mealLog = l; },
  log: () => mealLog,
  addExtra: (day, sw) => { mealLog[extraKey(day)] = { v: 1, t: Date.now(), sw }; },
  setV: (k, v) => { mealLog[k] = { v, t: Date.now(), sw: mealLog[k].sw }; },
};
`));
const api = mod.api;

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

const DAY = '2026-08-13';
/* Today as the plan has it: a snack among other meals. */
const day = { meals: [
  { t: '6:15 am',  l: 'Breakfast', kc: 500, cb: 80 },
  { t: '10:00 am', l: 'Snack',     kc: 300, cb: 40 },
] };

console.log('\n1. The morning in question: pancakes AND the snack');
api.set({});
api.setV.name;                                        // keep the linter honest
api.log()[api.logKey(DAY, '10:00 am')] = { v: 1, t: Date.now() };   // snack eaten
api.addExtra(DAY, { n: '2 small pancakes', kc: 180, cb: 30 });
const snack = api.ateGot(DAY, '10:00 am', day.meals[1]);
const extras = api.extrasOf(DAY);
console.log(`   snack ${snack.kc} kcal, extras ${extras.length} (${extras[0] && extras[0].n})`);
ok(snack.kc === 300 && snack.cb === 40, 'the snack is still recorded in full - not replaced');
ok(extras.length === 1 && extras[0].n === '2 small pancakes', 'and the pancakes are recorded alongside it');
ok(extras[0].got.kc === 180 && extras[0].got.cb === 30, 'the extra contributes its own calories and carbs');

console.log('\n2. An extra key can never collide with a planned meal');
const keys = Object.keys(api.log());
const mealKeys = day.meals.map((m) => api.logKey(DAY, m.t));
const xk = keys.find((k) => !mealKeys.includes(k));
console.log(`   extra key: ${xk}`);
ok(xk.startsWith(DAY + '|+'), "the key is the day plus '|+' and an id");
ok(!mealKeys.some((k) => k === xk), 'it is not any planned meal key');
ok(api.extrasOf(DAY).length === 1 && api.ateGot(DAY, '6:15 am', day.meals[0]).f === 0,
   'and an extra is not mistaken for a meal that was eaten');

console.log('\n3. Fractions apply to an extra too');
api.setV(xk, 0.5);
ok(api.extrasOf(DAY)[0].got.kc === 90, 'half of it is half the calories');
ok(api.extrasOf(DAY)[0].got.cb === 15, 'and half the carbs');

console.log('\n4. Dialling it to zero removes it');
api.setV(xk, 0);
ok(api.extrasOf(DAY).length === 0, 'a zeroed extra no longer appears');
ok(Object.prototype.hasOwnProperty.call(api.log(), xk),
   'but the entry survives, so the other phone learns of the removal rather than re-adding it');

console.log('\n5. Carb adherence counts off-plan carbohydrate');
api.set({});
api.log()[api.logKey(DAY, '6:15 am')] = { v: 1, t: Date.now() };
const before = api.carbAdherence(DAY, day);
api.addExtra(DAY, { n: 'two pancakes', kc: 180, cb: 30 });
const after = api.carbAdherence(DAY, day);
console.log(`   planned 120 g; adherence ${(before*100).toFixed(0)}% -> ${(after*100).toFixed(0)}%`);
ok(before !== null && Math.abs(before - 80 / 120) < 0.01, 'breakfast alone is 80 of 120 g');
ok(Math.abs(after - 110 / 120) < 0.01, 'the extra 30 g counts towards the target');
ok(after <= 1, 'and adherence never exceeds 100%');

console.log('\n6. A day with only an extra still reports');
api.set({});
api.addExtra(DAY, { n: 'a stray flapjack', kc: 250, cb: 45 });
ok(api.carbAdherence(DAY, day) !== null, 'an extra alone is enough to have something to report');

console.log('\n7. An extra with no name is ignored');
api.set({});
api.addExtra(DAY, { n: '', kc: 999, cb: 999 });
ok(api.extrasOf(DAY).length === 0, 'a nameless entry cannot silently add 999 kcal');

console.log('\n8. It survives the Worker with no schema change');
/* The claim this whole design rests on. cleanLog whitelists its fields and
   silently drops anything it does not recognise - that already cost this app
   dish.ai - so an extra rides on the {n, kc, cb} shape a swap already uses. If
   this section fails, extras vanish on the way to the other phone. */
const { mergeByTime, cleanLog, prune } = await (await import('./load-worker.mjs'))
  .loadWorker(['mergeByTime', 'cleanLog', 'prune']);

const k = `${DAY}|+xabc123`;
const sent = { [k]: { v: 0.5, t: Date.now(), sw: { n: '2 small pancakes', kc: 180, cb: 30 } } };
const merged = mergeByTime({}, sent, cleanLog);
const back = merged[k];
console.log(`   round-tripped: ${back ? JSON.stringify(back.sw) : 'DROPPED'}`);
ok(!!back, 'the entry is accepted by the Worker at all');
ok(back && back.v === 0.5, 'the fraction survives');
ok(back && back.sw && back.sw.n === '2 small pancakes', 'the name survives');
ok(back && back.sw && back.sw.kc === 180 && back.sw.cb === 30, 'the calories and carbs survive');
ok(Object.keys(merged).length === 1, 'and nothing else was invented');

/* And the key itself must not be mangled or the day can never find it again. */
ok(Object.keys(merged)[0] === k, 'the key comes back byte-identical');
ok(api.extrasOf.call(null, DAY) !== undefined, 'extrasOf is callable against it');

/* The bounds the Worker puts on a swap apply here too, which is the point of
   reusing the shape rather than inventing a field. */
const silly = { [`${DAY}|+xbig`]: { v: 1, t: Date.now(), sw: { n: 'x', kc: 99999, cb: 99999 } } };
const capped = mergeByTime({}, silly, cleanLog)[`${DAY}|+xbig`];
ok(capped.sw.kc === 5000 && capped.sw.cb === 1000, `a typo is clamped, not stored (${capped.sw.kc} kcal)`);

/* Old extras age out with everything else in the log. */
const st = { ticks: {}, extras: {}, dishes: {}, pantry: {},
             log: { [k]: { v: 1, t: Date.now() - 100 * 86400000, sw: { n: 'old', kc: 10, cb: 1 } } } };
prune(st);
ok(!(k in st.log), 'an extra older than 90 days is pruned like any other log entry');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
