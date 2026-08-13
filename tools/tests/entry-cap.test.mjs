/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Prove the entry-cap fix against the audit's exact attack, using the real
   functions lifted out of worker.js rather than a paraphrase of them. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { loadWorker } from './load-worker.mjs';

const { mergeByTime, prune, cleanExtra, cleanTick, MAX_BODY, MAX_ENTRIES, ListDO } =
  await loadWorker(['mergeByTime', 'prune', 'cleanExtra', 'cleanTick', 'MAX_BODY', 'MAX_ENTRIES', 'ListDO']);

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. The audit attack: one PUT of 5000 fresh keys');
const attack = {};
for (let i = 0; i < 5000; i++) attack['k' + i] = { t: 1 };
const bodyBytes = JSON.stringify({ extras: attack }).length;
console.log(`   request body ${bodyBytes} bytes (MAX_BODY 262144, so it is accepted)`);
ok(bodyBytes < MAX_BODY, 'body passes the 256 KB cap, as the audit measured');

let extras = mergeByTime({}, attack, cleanExtra);
console.log(`   merged map: ${Object.keys(extras).length} keys`);
ok(Object.keys(extras).length <= 5000, 'result map is at or under MAX_ENTRIES');

console.log('\n2. Repeat the attack — the old bug was the per-call reset');
for (let r = 0; r < 3; r++) {
  const more = {};
  for (let i = 0; i < 5000; i++) more['round' + r + '_' + i] = { t: 2 + r };
  extras = mergeByTime(extras, more, cleanExtra);
}
console.log(`   after 3 more 5000-key PUTs: ${Object.keys(extras).length} keys`);
ok(Object.keys(extras).length === 5000, 'the map does NOT grow past the ceiling across calls');

console.log('\n3. A full map must still accept edits to keys already in it');
const full = {};
for (let i = 0; i < 5000; i++) full['k' + i] = { name: 'x', t: 1000 };
const edited = mergeByTime(full, { k42: { name: 'milk', qty: '2', t: 9999 } }, cleanExtra);
ok(edited.k42 && edited.k42.name === 'milk', 'update to an existing key lands even at the ceiling');
ok(Object.keys(edited).length === 5000, 'and does not change the key count');
const deleted = mergeByTime(full, { k7: { name: 'x', deleted: true, t: 9999 } }, cleanExtra);
ok(deleted.k7 && deleted.k7.deleted === true, 'delete of an existing key lands at the ceiling too');
const rejected = mergeByTime(full, { brandNew: { name: 'nope', t: 9999 } }, cleanExtra);
ok(!('brandNew' in rejected), 'a NEW key is refused when the map is full');

console.log('\n4. The size guard, exercised through the real ListDO.merge');
/* This section used to be `ok(true, ...)` — it printed a number and asserted
   nothing. A review caught it, and driving merge() for real then caught a defect
   in the guard itself: it priced the WHOLE stored state, and `plan` is ~77 KB of
   the 256 KB budget while the client never sends it. */

/* Enough of a Durable Object for merge() to run: one-at-a-time, and a Map. */
function fakeDO() {
  const store = new Map();
  const ctx = {
    storage: {
      get: async (k) => store.get(k),
      put: async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); },
    },
    blockConcurrencyWhile: async (fn) => await fn(),
  };
  const env = { LIST: { get: async () => null } };
  const doInst = new ListDO(ctx, env);
  return { doInst, store };
}

const bigPlan = { block: 'August 2026', weeks: [{ id: 'w1' }], days: [], training: [],
                  filler: 'x'.repeat(120000) };   // a plan bigger than a third of MAX_BODY

{
  const { doInst, store } = fakeDO();
  await store.set('state', { ticks: {}, extras: {}, pantry: {}, log: {}, dishes: {}, plan: bigPlan, rev: 1 });
  console.log(`   stored plan alone: ${JSON.stringify(bigPlan).length} bytes of a ${MAX_BODY}-byte budget`);
  const out = await doInst.merge({ ticks: { 'w1|milk': { v: true, t: Date.now() } } });
  ok(!out.refused, 'a plan far bigger than a third of the budget does NOT block a single tick');
  ok(out.ticks && out.ticks['w1|milk'] && out.ticks['w1|milk'].v === true, 'and the tick is actually stored');
}

{
  /* Now make the SYNCED maps genuinely too big to send, which is the real limit. */
  const { doInst, store } = fakeDO();
  await store.set('state', { ticks: {}, extras: {}, pantry: {}, log: {}, dishes: {}, plan: bigPlan, rev: 1 });
  const huge = {};
  for (let i = 0; i < 6000; i++) huge['key-number-' + i] = { name: 'a'.repeat(60), qty: '1', t: 1000 + i };
  const body = JSON.stringify({ extras: huge });
  console.log(`   a client body of ${body.length} bytes whose merged maps exceed ${MAX_BODY}`);
  const out = await doInst.merge({ extras: huge });
  ok(out.refused, `an oversized synced map IS refused (${out.refused || 'not refused'})`);
  const stored = await store.get('state');
  ok(stored.rev === 1, 'and nothing was written - rev did not move');
  ok(Object.keys(stored.extras).length === 0, 'the stored extras are untouched');
  ok(!(await store.get('prev')), 'the undo snapshot was not burned either');
}

{
  /* A refusal must never latch: a write that does not grow the copy still lands. */
  const { doInst, store } = fakeDO();
  const atCeiling = {};
  for (let i = 0; i < 5000; i++) atCeiling['k' + i] = { name: 'b'.repeat(50), qty: '', cost: 0, store: 'A', week: '', t: 1000 };
  await store.set('state', { ticks: {}, extras: atCeiling, pantry: {}, log: {}, dishes: {}, plan: bigPlan, rev: 1 });
  const sizeNow = JSON.stringify({ ticks: {}, extras: atCeiling, pantry: {}, log: {}, dishes: {} }).length;
  console.log(`   sitting at ${sizeNow} bytes of synced maps (over the limit)`);
  const out = await doInst.merge({ extras: { k0: { name: 'b'.repeat(50), qty: '', cost: 0, store: 'A', week: '', t: 9999 } } });
  ok(!out.refused, 'an in-place edit is still accepted when the copy is already oversized');
  const stored = await store.get('state');
  ok(stored.extras.k0.t === 9999, 'and it really was applied');
}

console.log('\n5. prune() can finally drain ticks');
const old = Date.now() - 100 * 86400000;
const st = {
  ticks: { bought: { v: true, t: old }, skipped: { v: false, t: old }, fresh: { v: true, t: Date.now() } },
  extras: {}, log: {}, dishes: {},
};
prune(st);
ok(!('bought' in st.ticks), 'a 100-day-old TICKED item is dropped (used to live forever)');
ok(!('skipped' in st.ticks), 'a 100-day-old unticked item is still dropped');
ok('fresh' in st.ticks, "today's tick is kept");

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
