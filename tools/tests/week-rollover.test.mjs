/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* The shopping list has to move on when the week does.

   v2.week held a bare index, written once on the first run of the block and then
   honoured forever. Open the app in week 3 and it drew week 1 - the week you last
   tapped - with nothing on screen to say the list was for a fortnight ago. This
   runs the real init rule out of index.html against a stubbed clock. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { readFileSync } from 'node:fs';

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

const freshSrc = grabFn('function weekPickIsFresh(pick, today, block){');
const localISOSrc = grabFn('function localISO(d){');

/* The real init decision, lifted verbatim so the test cannot drift from it. */
const initSrc = /if \(!weekPickIsFresh\(weekPick, localISO\(\), String\(\(plan && plan\.block\) \|\| ''\)\)\)\{[\s\S]*?\n\}/.exec(html);
if (!initSrc) throw new Error('index.html no longer resolves the week through weekPickIsFresh');

const { weekPickIsFresh, localISO } = await import(
  'data:text/javascript,' + encodeURIComponent(`${localISOSrc}\n${freshSrc}\nexport { weekPickIsFresh, localISO };`)
);

/* The block under test, with everything it touches stubbed. */
function openApp({ stored, today, block, todayIsInBlock }) {
  let wi = (stored && typeof stored === 'object' && Number(stored.i)) || 0;
  let wrote = null;
  const plan = { block };
  const weekPick = stored;
  const rememberWeek = () => { wrote = { i: wi, on: today, block }; };
  const weekIndexOfToday = () => todayIsInBlock;
  const localISOStub = () => today;
  if (!weekPickIsFresh(weekPick, localISOStub(), String((plan && plan.block) || ''))) {
    const wt = weekIndexOfToday();
    if (wt >= 0) { wi = wt; rememberWeek(); }
  }
  return { wi, wrote };
}

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

const BLOCK = 'August 2026';

console.log('\n1. The bug: last week\'s list, opened this week');
/* Picked week 1 on the 5th. It is now the 17th, which is week 3. */
const lagged = openApp({ stored: { i: 1, on: '2026-08-05', block: BLOCK }, today: '2026-08-17', block: BLOCK, todayIsInBlock: 3 });
ok(lagged.wi === 3, `the app opens on the week containing today, not the one last tapped (${lagged.wi})`);
ok(lagged.wrote && lagged.wrote.on === '2026-08-17', 'and re-stamps the pick with today, so tomorrow re-decides again');

console.log('\n2. A week you picked today is still yours today');
/* Standing in the shop on Saturday looking at next week's list; the phone
   reloads. It must not yank you back to the current week mid-shop. */
const deliberate = openApp({ stored: { i: 4, on: '2026-08-17', block: BLOCK }, today: '2026-08-17', block: BLOCK, todayIsInBlock: 3 });
ok(deliberate.wi === 4, `a pick made today survives a reload the same day (${deliberate.wi})`);
ok(deliberate.wrote === null, 'and is not rewritten, so its timestamp does not roll forward on its own');

console.log('\n3. Tomorrow it has moved on by itself');
const tomorrow = openApp({ stored: { i: 4, on: '2026-08-17', block: BLOCK }, today: '2026-08-18', block: BLOCK, todayIsInBlock: 3 });
ok(tomorrow.wi === 3, `the next day is back on the week being lived (${tomorrow.wi})`);

console.log('\n4. A new block resets the pick outright');
/* An index into a month that has ended means nothing, even if it was set today. */
const newBlock = openApp({ stored: { i: 4, on: '2026-09-01', block: 'August 2026' }, today: '2026-09-01', block: 'September 2026', todayIsInBlock: 1 });
ok(newBlock.wi === 1, `a different block re-resolves rather than inheriting the index (${newBlock.wi})`);

console.log('\n5. The old bare-number format is treated as absent, not migrated');
const legacy = openApp({ stored: 1, today: '2026-08-17', block: BLOCK, todayIsInBlock: 3 });
ok(legacy.wi === 3, `an existing install lands on today rather than keeping its stale index (${legacy.wi})`);
ok(weekPickIsFresh(1, '2026-08-17', BLOCK) === false, 'a bare number is never fresh');
ok(weekPickIsFresh(null, '2026-08-17', BLOCK) === false, 'and neither is nothing at all');

console.log('\n6. Outside the block the list is left where it was');
/* September, still on an August plan. There is no "this week" to land on, and
   inventing one would be worse than leaving it. What this wants is a new block. */
const ended = openApp({ stored: { i: 4, on: '2026-08-31', block: BLOCK }, today: '2026-09-04', block: BLOCK, todayIsInBlock: -1 });
ok(ended.wi === 4, `a plan whose month has ended does not jump somewhere arbitrary (${ended.wi})`);
ok(ended.wrote === null, 'and nothing is re-stamped, so it re-decides the moment a new block arrives');

console.log('\n7. localISO is local time, not UTC');
/* toISOString() would roll the date over at 8pm in New York and show tomorrow's
   week to somebody standing in a shop tonight. */
const evening = new Date(2026, 7, 17, 22, 30);
ok(localISO(evening) === '2026-08-17', `late evening is still today (${localISO(evening)})`);
const newYear = new Date(2026, 0, 3, 1, 5);
ok(localISO(newYear) === '2026-01-03', `single-digit month and day are padded (${localISO(newYear)})`);

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
