/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* One month of runway, kept without anybody pressing a button.

   The rider asked for next month to exist before it starts: on 1 September,
   September is live AND October is already built. Two things have to hold for
   that to be safe rather than merely automatic - a month that has NOT ended is
   never carried forward, and a month that arrives by itself passes the same
   validator as one published by hand. Both are checked here.

   The queue lives under its own storage key rather than inside `state`, because
   a plan is ~77 KB and read() hands `state` back wholesale. That is checked
   too: it is the difference between /state costing 77 KB and 154 KB. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { loadWorker } from './load-worker.mjs';

const { ListDO, validatePlan, blockYM, nextYM, ROLL_MAX } =
  await loadWorker(['ListDO', 'validatePlan', 'blockYM', 'nextYM', 'ROLL_MAX']);

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

const august = JSON.parse(readFileSync(join(ROOT, 'plan.json'), 'utf8')).plan;

function fakeDO(plan) {
  const store = new Map();
  store.set('state', {
    rev: 4, updated: null, plan: JSON.parse(JSON.stringify(plan)),
    extras: {}, ticks: { 'week-1|MILK': { v: true, t: 1 } }, pantry: {}, log: {}, dishes: {},
  });
  const ctx = {
    storage: {
      get: async (k) => store.get(k),
      put: async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); },
      delete: async (k) => { store.delete(k); },
    },
    blockConcurrencyWhile: async (fn) => await fn(),
  };
  return { d: new ListDO(ctx, { LIST: { get: async () => null } }), store };
}

console.log('\n1. nextYM carries the year, December included');
ok(nextYM('2026-08') === '2026-09', 'August -> September');
ok(nextYM('2026-12') === '2027-01', 'December -> January, not month 13');
ok(nextYM('nonsense') === null, 'rubbish is refused rather than guessed at');

console.log('\n2. On 31 August: August stays live, September is built ahead');
{
  const { d, store } = fakeDO(august);
  const r = await d.rollBlocks('2026-08');
  ok(r.ok && r.rolled === null, 'nothing rolled - August has not ended');
  ok(r.block === 'August 2026', `the live block is still August (${r.block})`);
  ok(r.next === 'September 2026', `and September is queued (${r.next})`);
  ok(store.get('state').rev === 4, 'rev did not move, so no phone is told to re-pull');
  ok(store.get('state').ticks['week-1|MILK'].v === true, 'this month\'s check-offs are untouched');
  ok(validatePlan(store.get('next')) === null, 'the queued month passes the publish validator');
}

console.log('\n3. On 1 September: September goes live, October is built ahead');
{
  const { d, store } = fakeDO(august);
  await d.rollBlocks('2026-08');              // the day before
  const r = await d.rollBlocks('2026-09');    // the rider opens the app
  ok(r.rolled === 'September 2026', `September rolled in by itself (${r.rolled})`);
  ok(store.get('state').plan.block === 'September 2026', 'and is the stored live block');
  ok(r.next === 'October 2026', `October is queued behind it (${r.next})`);
  ok(store.get('next').block === 'October 2026', 'and really is on disk');
  ok(store.get('state').rev === 5, 'rev moved, so the other phone pulls');
  ok(Object.keys(store.get('state').ticks).length === 0, 'a new month is a new shopping list');
  ok(store.get('prev').plan.block === 'August 2026', 'the undo snapshot holds August, so /undo puts it back');
  ok(!('next' in store.get('state')), 'the queue is NOT a field of state');
  const stateBytes = JSON.stringify(store.get('state')).length;
  const queueBytes = JSON.stringify(store.get('next')).length;
  ok(stateBytes < queueBytes * 1.6,
    `so /state stays one plan wide (${stateBytes} B, with ${queueBytes} B queued beside it)`);
}

console.log('\n4. Opening it twice in the same month changes nothing');
{
  const { d, store } = fakeDO(august);
  await d.rollBlocks('2026-09');
  const rev = store.get('state').rev, q = store.get('next').block;
  const again = await d.rollBlocks('2026-09');
  ok(again.rolled === null, 'the second open rolls nothing');
  ok(store.get('state').rev === rev, 'and does not move rev');
  ok(store.get('next').block === q, 'the queued month is left alone');
}

console.log('\n5. Away for a year: carried month by month, and capped');
{
  const { d, store } = fakeDO(august);
  const r = await d.rollBlocks('2027-03');
  ok(r.ok, 'a long absence still resolves');
  ok(store.get('state').plan.block === 'March 2027', `landed on the month being lived (${store.get('state').plan.block})`);
  ok(r.next === 'April 2027', `with April queued (${r.next})`);
  ok(validatePlan(store.get('state').plan) === null, 'and every carried month is still a valid plan');
}
{
  /* Further than the cap can reach in one request: it must stop, not spin. */
  const { d, store } = fakeDO(august);
  const r = await d.rollBlocks('2030-01');
  ok(r.ok, 'an absurd gap does not throw');
  const landed = blockYM(store.get('state').plan);
  ok(landed < '2030-01', `it did NOT reach today - the cap bit (${landed})`);
  /* Exactly ROLL_MAX carries from August 2026 and not one more, so the cap is
     doing the stopping rather than some accident of the generator. */
  let expect = '2026-08';
  for (let i = 0; i < ROLL_MAX; i++) expect = nextYM(expect);
  ok(landed === expect, `stopped after exactly ROLL_MAX=${ROLL_MAX} carries (${expect})`);
  ok(store.get('state').rev === 5, 'and that whole catch-up is one revision, not fourteen');
}

console.log('\n6. An account with no block is left alone, not invented for');
{
  const { d, store } = fakeDO(august);
  store.set('state', { rev: 0, plan: null, ticks: {}, extras: {}, pantry: {}, log: {}, dishes: {} });
  const r = await d.rollBlocks('2026-09');
  ok(r.ok === false, `refused: ${r.why}`);
  ok(!store.get('next'), 'and nothing was queued from nothing');
}

console.log('\n7. setNext replaces the month that has not started, and validates');
{
  const { d, store } = fakeDO(august);
  await d.rollBlocks('2026-08');
  const bad = await d.setNext({ block: 'October 2026' });
  ok(bad.ok === false, 'an invalid plan is refused');
  ok(store.get('next').block === 'September 2026', 'and the queued month is untouched by the attempt');
  ok(store.get('state').plan.block === 'August 2026', 'the LIVE block is never what setNext writes');
}

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
