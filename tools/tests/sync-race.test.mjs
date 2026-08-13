/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Run the REAL sync() out of index.html against a stubbed world, and tap the
   screen while the request is in flight. */
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

const syncSrc = grabFn('async function sync(push){');
const sigSrc = grabFn('function stateSig(){');

/* Everything sync() touches, stubbed. The maps and dirty are the real subjects. */
const harness = `
let ticks = {}, extras = {}, pantryState = {}, mealLog = {}, dishes = {};
let dirty = false, syncing = false, lastRev = 0, lastSync = '', needCode = false;
let plan = { weeks: [{ id: 'w1' }] }, planSig = '';
const cfg = { url: 'https://x.test', key: '1234' };
let queueCalls = 0, renderCalls = 0, persistCalls = 0;
const queue = () => { queueCalls++; dirty = true; persistCalls++; };
const render = () => { renderCalls++; };
const persist = () => { persistCalls++; };
const setDot = () => {};
const openSettings = () => {};
const fillPlan = (p) => p;
const jset = () => {};
const LS = { set: () => {}, get: () => null };
let pushRefused = false, syncNote = '';
/* One object per selector, so writes to #s_stat are observable rather than
   dropped on the floor — the earlier stub returned a fresh object each call,
   which is why the 413 assertion below was passing vacuously. */
const els = {};
const $ = (sel) => (els[sel] = els[sel] || { textContent: '', value: '' });
let onFlight = null;                       // runs while the fetch is in the air
let nextResponse = null;
let methods = [];                          // 'PUT' or 'GET', in order
globalThis.fetch = async (url, init) => {
  methods.push((init && init.method) || 'GET');
  if (onFlight) { onFlight(); onFlight = null; }
  return {
    ok: nextResponse.status ? nextResponse.status < 400 : true,
    status: nextResponse.status || 200,
    json: async () => nextResponse.body,
  };
};
${sigSrc}
${syncSrc}
export const api = {
  sync,
  state: () => ({ ticks, extras, pantryState, mealLog, dishes, dirty }),
  set: (o) => { if (o.ticks) ticks = o.ticks; if (o.extras) extras = o.extras;
                if (o.mealLog) mealLog = o.mealLog; if (o.dirty !== undefined) dirty = o.dirty; },
  tap: (k, v, t) => { ticks[k] = { v, t }; },
  logMeal: (k, v, t) => { mealLog[k] = { v, t }; },
  duringFlight: (fn) => { onFlight = fn; },
  reply: (body, status) => { nextResponse = { body, status }; },
  counts: () => ({ queueCalls, renderCalls, persistCalls }),
  resetCounts: () => { queueCalls = 0; renderCalls = 0; persistCalls = 0; methods = []; },
  methods: () => methods.slice(),
  note: () => syncNote,
  statText: () => (els['#s_stat'] || {}).textContent || '',
};
`;

const { api } = await import('data:text/javascript,' + encodeURIComponent(harness));

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. The bug: tap milk while a pull is in flight');
/* Server holds milk un-ticked. */
api.set({ ticks: { 'w1|milk': { v: false, t: 1000 } }, dirty: false });
api.reply({ ticks: { 'w1|milk': { v: false, t: 1000 } }, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 7 });
api.resetCounts();
/* Mid-flight, he taps it. */
api.duringFlight(() => api.tap('w1|milk', true, 2000));
await api.sync(false);

const s1 = api.state();
console.log(`   after the pull: milk v=${s1.ticks['w1|milk'].v} t=${s1.ticks['w1|milk'].t}, dirty=${s1.dirty}`);
ok(s1.ticks['w1|milk'].v === true, 'the tap survived the pull (was reverted to false)');
ok(s1.ticks['w1|milk'].t === 2000, 'and kept its own timestamp, so the server merge will accept it');
ok(s1.dirty === true, 'dirty stayed set, so it will actually be sent');
ok(api.counts().queueCalls === 1, 'the push was re-armed (the mid-flight debounce was spent)');

console.log('\n2. The same window on a push, not just a pull');
api.set({ ticks: { 'w1|eggs': { v: false, t: 1000 } }, dirty: true });
api.reply({ ticks: { 'w1|eggs': { v: false, t: 1000 } }, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 8 });
api.resetCounts();
api.duringFlight(() => api.tap('w1|eggs', true, 3000));
await api.sync(true);
const s2 = api.state();
ok(s2.ticks['w1|eggs'].v === true, 'a tap during a PUT survives too');
ok(s2.dirty === true && api.counts().queueCalls === 1, 'and is re-queued');

console.log('\n3. Nothing tapped mid-flight: the server must win cleanly');
api.set({ ticks: { 'w1|milk': { v: false, t: 1000 } }, dirty: false });
/* The other phone ticked it. */
api.reply({ ticks: { 'w1|milk': { v: true, t: 5000 } }, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 9 });
api.resetCounts();
await api.sync(false);
const s3 = api.state();
ok(s3.ticks['w1|milk'].v === true, "the other phone's tick is adopted");
ok(s3.dirty === false, 'dirty is cleared when nothing was written locally');
ok(api.counts().queueCalls === 0, 'and no pointless push is queued');
ok(api.counts().renderCalls === 1, 'it repaints, because something did change');

console.log('\n4. A pruned key must NOT be resurrected');
/* This is why the fix carries only in-flight writes instead of local-wins. */
api.set({ ticks: {}, mealLog: { '2026-01-01|6:15 am': { v: 1, t: 100 } }, dirty: false });
api.reply({ ticks: {}, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 10 });
api.resetCounts();
await api.sync(false);
const s4 = api.state();
ok(!('2026-01-01|6:15 am' in s4.mealLog), 'an old log entry the server pruned stays gone');
ok(s4.dirty === false, 'and that is not treated as a local change to push back');

console.log('\n5. A meal logged mid-flight survives, while a pruned one stays pruned');
api.set({ ticks: {}, mealLog: { 'old|6:15 am': { v: 1, t: 100 } }, dirty: false });
api.reply({ ticks: {}, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 11 });
api.resetCounts();
api.duringFlight(() => api.logMeal('2026-08-13|6:15 am', 1, 9000));
await api.sync(false);
const s5 = api.state();
ok(s5.mealLog['2026-08-13|6:15 am'] && s5.mealLog['2026-08-13|6:15 am'].v === 1, 'the meal logged mid-flight is kept');
ok(!('old|6:15 am' in s5.mealLog), 'the pruned one is still dropped');
ok(s5.dirty === true, 'and the new one is queued to send');

console.log('\n6. The client must merge by the same rule as the Worker');
/* Mid-flight tap at t=2000, but the other phone wrote at t=5000. The server would
   keep its own on the next merge, so showing ours would be showing something
   about to vanish. */
api.set({ ticks: { 'w1|bread': { v: false, t: 1000 } }, dirty: false });
api.reply({ ticks: { 'w1|bread': { v: true, t: 5000 } }, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 12 });
api.resetCounts();
api.duringFlight(() => api.tap('w1|bread', false, 2000));
await api.sync(false);
const s7 = api.state();
console.log(`   ours t=2000 vs theirs t=5000 -> v=${s7.ticks['w1|bread'].v} t=${s7.ticks['w1|bread'].t}`);
ok(s7.ticks['w1|bread'].t === 5000, 'the newer write from the other phone wins, as the server would decide');
ok(s7.dirty === false, 'and nothing is queued, because there is nothing that would survive the merge');

/* And it must REPAINT when it discards our write, or the row stays painted the
   way the finger left it while the state says the opposite. The tick handler
   paints optimistically, so nothing else will correct the DOM. */
ok(api.counts().renderCalls === 1, 'discarding our mid-flight write triggers a repaint');

/* The other way round: ours is newer, so ours must win and be pushed. */
api.set({ ticks: { 'w1|jam': { v: false, t: 1000 } }, dirty: false });
api.reply({ ticks: { 'w1|jam': { v: false, t: 1500 } }, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 13 });
api.resetCounts();
api.duringFlight(() => api.tap('w1|jam', true, 9000));
await api.sync(false);
const s8 = api.state();
ok(s8.ticks['w1|jam'].t === 9000 && s8.ticks['w1|jam'].v === true, 'our newer mid-flight tap wins');
ok(s8.dirty === true && api.counts().queueCalls === 1, 'and is queued to send');

console.log('\n7. A refused push must not stop this phone receiving');
/* The earlier version of this section asserted nothing about the 413 at all:
   sync() swallows its own errors, so `msg` was always '' and never checked. Caught
   in review. Driving it properly then exposed the real defect — `dirty` stays set
   on a failure, so `push || dirty` chose PUT on every later sync and the GET
   branch became unreachable: the phone silently stopped receiving the other one. */
api.set({ ticks: {}, dirty: true });
api.reply({}, 413);
api.resetCounts();
await api.sync(true);
const s6 = api.state();
ok(s6.dirty === true, 'a refused push leaves dirty set rather than losing the write');
ok(api.methods().join() === 'PUT', 'the refused attempt was a PUT');
ok(api.note() === 'List too large to save', `the dot says why (${api.note()})`);
ok(/90 days/.test(api.statText()), 'and the detail says old items clear themselves, not "delete some"');
ok(!/delete some/i.test(api.statText()), 'it must NOT advise deleting - a tombstone makes the copy bigger');

/* The next sync has to pull, or this phone is cut off from the other one. */
api.reply({ ticks: { 'w1|from-other-phone': { v: true, t: 7000 } }, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 20 });
api.resetCounts();
await api.sync(false);
ok(api.methods().join() === 'GET', 'the sync after a refusal is a GET, even though dirty is still set');
ok(api.state().ticks['w1|from-other-phone'], "so the other phone's changes still arrive");
/* That pull adopts the server's copy, so the write that could not be saved is
   gone. That is a real loss, and the point of this assertion is that it is not a
   SILENT one: the dot must keep saying so until a push actually succeeds. */
ok(api.note() === 'List too large to save', 'the warning survives the pull, so the lost change is not silent');

/* And it clears only when a push finally works. */
api.reply({ ticks: {}, extras: {}, pantry: {}, log: {}, dishes: {}, rev: 21 });
api.set({ dirty: true });
api.resetCounts();
await api.sync(true);
ok(api.methods().join() === 'PUT', 'a later push is attempted again, not abandoned');
ok(api.note() === '', 'and a successful push is what clears the warning');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
