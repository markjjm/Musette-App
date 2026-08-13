/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* index.html:3011 says an estimate must not pass for a measurement. macroRow did
   the opposite: day.ft is a day-type template, and an overstated one let ten days
   CLEAR the only low-fat warning the app has - day 28 displaying 21.1% against a
   real 16.9%. This runs the real macroRow and requires it to refuse the question
   when the numbers do not reconcile. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(join(ROOT, 'web/public/index.html'), 'utf8');

function grabFn(decl) {
  const i = html.indexOf(decl);
  if (i < 0) throw new Error(`not found: ${decl}`);
  let d = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}' && --d === 0) break;
  }
  return html.slice(i, j + 1);
}

const mod = await import('data:text/javascript,' + encodeURIComponent(`
const infoBtn = () => '';
${grabFn('function macroRow(')}
export { macroRow };
`));
const { macroRow } = mod;

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

/* Pull the F tile out of the rendered row. */
const fatTile = (h) => {
  const tiles = h.split('<div class="hxm').slice(1);
  return tiles[tiles.length - 1];
};
const saysLow = (h) => /^ est low/.test(fatTile(h));
const marker = (h) => (/<i>F([*?])/.exec(fatTile(h)) || [])[1] || '';

console.log('\n1. Day 28: the case that clears a warning it should raise');
/* Stated pr=175 ft=63 against kc=2693 - the real fat is ~50.7 g, i.e. 16.9%. */
const d28 = { pr: 175, ft: 63, cb: 391 };
const sum28 = { kc: 2693, cb: 391 };
const h28 = macroRow(d28, sum28, { kc: 2693, cb: 391 });
const stated28 = 4 * 175 + 9 * 63 + 4 * 391;
console.log(`   4*pr+9*ft+4*cb = ${stated28} against kc ${sum28.kc} (${((stated28 / sum28.kc - 1) * 100).toFixed(1)}% out)`);
console.log(`   9*ft/kc = ${((9 * 63) / 2693 * 100).toFixed(1)}%, real is 16.9%`);
ok(marker(h28) === '?', `fat is marked ? not * (got "${marker(h28)}")`);
ok(!saysLow(h28), 'it does NOT claim the day is low in fat');
ok(!/est low/.test(h28), 'and the low class appears nowhere in the row');

console.log('\n2. A day whose macros DO reconcile keeps a working warning');
/* 4*120 + 9*50 + 4*400 = 2530. At 2530 kcal, 9*50/2530 = 17.8% -> genuinely low. */
const lowDay = { pr: 120, ft: 50, cb: 400 };
const lowSum = { kc: 2530, cb: 400 };
const hLow = macroRow(lowDay, lowSum, { kc: 2530, cb: 400 });
console.log(`   reconciles exactly; 9*ft/kc = ${((9 * 50) / 2530 * 100).toFixed(1)}%`);
ok(marker(hLow) === '*', 'fat is marked * because the figures agree');
ok(saysLow(hLow), 'and the low-fat warning DOES fire - the check still works');

console.log('\n3. A reconciling day above the floor must not be flagged');
/* 4*150 + 9*80 + 4*300 = 2520; 9*80/2520 = 28.6% */
const okDay = { pr: 150, ft: 80, cb: 300 };
const okSum = { kc: 2520, cb: 300 };
const hOk = macroRow(okDay, okSum, { kc: 2520, cb: 300 });
console.log(`   9*ft/kc = ${((9 * 80) / 2520 * 100).toFixed(1)}%`);
ok(marker(hOk) === '*', 'marked *');
ok(!saysLow(hOk), 'and not flagged low, correctly');

console.log('\n4. Every day of the real plan');
const plan = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8')).plan;
let unknown = 0, low = 0, clean = 0, wrongClear = 0;
for (const d of plan.days) {
  const sum = { kc: d.kc, cb: d.cb };
  const h = macroRow(d, sum, { kc: d.kc, cb: d.cb });
  const stated = 4 * (d.pr || 0) + 9 * (d.ft || 0) + 4 * (d.cb || 0);
  const reconciles = Math.abs(stated - d.kc) / d.kc <= 0.03;
  if (!reconciles) {
    unknown++;
    /* The whole point: a day whose numbers do not add up must not be presented
       as either safe or unsafe. */
    if (saysLow(h)) wrongClear++;
    if (marker(h) !== '?') wrongClear++;
  } else if (saysLow(h)) low++;
  else clean++;
}
console.log(`   ${unknown} days cannot be judged, ${low} flagged low, ${clean} above the floor`);
ok(unknown > 0, 'the real plan does contain days that cannot be judged');
ok(wrongClear === 0, 'and not one of them is presented as judged either way');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
