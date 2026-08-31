/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Two defects found on 31 August 2026, both of which presented as "the app
   shows a local copy with no data".

   The first: setPlan read validatePlan's return as an OBJECT. It returns null
   when a plan is good and an error STRING when it is not, so `if (!v.ok)` threw
   a TypeError on every VALID plan - inside blockConcurrencyWhile, so the put()
   never ran. Publishing a month therefore stored nothing, for every account,
   through both /plan/publish and onboarding. Nothing caught it because nothing
   drove setPlan for real.

   The second: the account page rendered a plan shape that has never existed -
   day.train, day.carb, day.dt, meals with .kind/.name/.desc, and a top-level
   plan.shopping. So every day drew as "Rest Day" with a stock dinner line and a
   carb figure invented from kc*0.55/4, and the grocery pane was always empty.

   These run the real code: worker.js's own setPlan, and the renderers lifted
   out of account.html rather than a paraphrase of them. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { loadWorker } from './load-worker.mjs';

const { generateBlock, validatePlan, cleanTick, ListDO } =
  await loadWorker(['generateBlock', 'validatePlan', 'cleanTick', 'ListDO']);

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

const prev = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8')).plan;
const plan = generateBlock(prev, '2026-09', {}).plan;

/* Enough of a Durable Object for setPlan() to run. State is pre-seeded so
   load() never reaches ctx.id, which a fake has no business owning. */
function fakeDO() {
  const store = new Map();
  store.set('state', { ticks: { old: { v: true, t: 1 } }, extras: {}, pantry: {}, log: {}, dishes: {}, plan: prev, rev: 7 });
  const ctx = {
    storage: {
      get: async (k) => store.get(k),
      put: async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); },
    },
    blockConcurrencyWhile: async (fn) => await fn(),
  };
  return { doInst: new ListDO(ctx, { LIST: { get: async () => null } }), store };
}

console.log('\n1. validatePlan returns null or a string - never an object');
/* The whole defect in one line: any caller reaching for .ok on this throws. */
ok(validatePlan(plan) === null, 'a good plan returns exactly null');
ok(typeof validatePlan({ block: 'September 2026' }) === 'string', 'a bad plan returns a string, not {ok:false}');

console.log('\n2. Publishing a valid month actually reaches storage');
{
  const { doInst, store } = fakeDO();
  const out = await doInst.setPlan(plan, true);
  ok(out && out.ok === true, `setPlan reports ok (${JSON.stringify(out && out.ok)})`);
  ok(store.get('state').plan.block === 'September 2026', 'and the stored block is the new one, not the old');
  ok(store.get('state').rev === 8, 'the revision moved, so a phone polling /rev will pull');
  ok(Object.keys(store.get('state').ticks).length === 0, 'resetTicks cleared last month\'s check-offs');
}

console.log('\n3. A bad plan is refused without wedging the object');
{
  const { doInst, store } = fakeDO();
  const out = await doInst.setPlan({ block: 'September 2026' }, true);
  ok(out && out.ok === false && typeof out.error === 'string', 'setPlan reports {ok:false, error}');
  ok(store.get('state').plan.block === 'August 2026', 'and the block already stored is untouched');
}

console.log('\n4. The profile page reads the plan\'s own shape');
/* Lifted verbatim out of the page. If these markers move, this test must move
   with them rather than quietly stop checking anything. */
const page = readFileSync(join(ROOT, 'web/site/account.html'), 'utf8');
const from = page.indexOf('  var MONTHS =');
const to = page.indexOf('  /* PUT /state is the route that exists.');
if (from < 0 || to < 0) throw new Error('account.html renderers not found - update the markers in this test');

const els = {};
const mk = () => ({ innerHTML: '', textContent: '', querySelectorAll: () => [] });
for (const id of ['planDaysContainer', 'planSubtitle', 'groceryContainer']) els[id] = mk();
const R = new Function('$', 'fullState', 'saveTicks',
  'return (function(){' + page.slice(from, to) + '\nreturn {renderPlan, renderGroceries};})()'
)((id) => els[id], null, () => {});

R.renderPlan(plan);
const h = els.planDaysContainer.innerHTML;
ok((h.match(/class="day-row"/g) || []).length === 30, 'every one of September\'s 30 days is drawn');
ok(!/>Rest Day</.test(h), 'no day is mislabelled "Rest Day" - the hours come from plan.training');
ok(!h.includes('Calibrated Athlete Dinner'), 'no day falls back to the stock dinner line');

const d1 = plan.days[0];
const invented = Math.round(d1.kc * 0.55 / 4);
ok(h.includes(d1.cb + 'g carbs'), `day 1 shows the plan's own carbs (${d1.cb}g)`);
ok(invented === d1.cb || !h.includes(invented + 'g carbs'), `and not the invented kc*0.55/4 figure (${invented}g)`);
ok(h.includes(d1.dish), `the dinner is the day's actual dish (${d1.dish})`);
ok(h.includes('(09-01)'), 'the day carries a real date, derived from the block name');

console.log('\n5. Groceries come from weeks[].lists, and tick like the app does');
ok(!('shopping' in plan), 'a plan has no top-level .shopping - reading one was the bug');
R.renderGroceries(plan, {});
const g = els.groceryContainer.innerHTML;
ok(!g.includes('No grocery items planned'), 'the pane is not empty for a plan that has lists');
const boxes = (g.match(/type="checkbox"/g) || []).length;
ok(boxes > 100, `the month draws ${boxes} shopping lines`);

const keys = [...g.matchAll(/data-key="([^"]+)"/g)].map((m) => m[1]);
/* tickKey(weekId, name) in the app is `weekId + '|' + name`. A key in any other
   shape ticks a row the app will never look at. */
ok(keys.every((k) => /^week-\d+\|.+/.test(k)), 'every key is the app\'s weekId|name form');
const wk1 = plan.weeks[0];
ok(keys.includes(wk1.id + '|' + wk1.lists.A[0].items[0].n), 'and matches the item it was built from');

console.log('\n   a tick written here must survive the Worker\'s merge');
ok(cleanTick({ v: true, t: Date.now() }) !== null, '{v, t} is accepted by cleanTick');
ok(cleanTick(Date.now()) === null, 'a bare timestamp - what this page used to write - is dropped');

console.log('\n6. The page calls routes that exist');
const script = page.slice(page.indexOf('<script>'));
ok(!/['"]\/sync['"]/.test(script), 'no call to /sync, which has never been a route');
ok(!/plan\.shopping/.test(script), 'nothing reads plan.shopping');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
