/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Prove /ride is no longer an unmetered proxy: every intervals.icu call goes
   through one cache, and cache hits carry the full security headers because they
   go back through json() like everything else. */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
import { loadWorker } from './load-worker.mjs';

let upstreamCalls = 0;
let lastAuthHeader = null;

/* Minimal edge-cache stand-in: keyed on the Request url, like the real one. */
const store = new Map();
globalThis.caches = {
  default: {
    async match(req) {
      const hit = store.get(req.url);
      return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
    },
    async put(req, res) {
      store.set(req.url, { body: await res.text(), headers: Object.fromEntries(res.headers) });
    },
  },
};

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('intervals.icu')) {
    upstreamCalls += 1;
    lastAuthHeader = init && init.headers && init.headers.Authorization;
    return new Response(JSON.stringify([
      { id: 'a1', start_date_local: '2026-08-13T07:00:00', name: 'Morning ride',
        moving_time: 3600, distance: 30000, calories: 600, icu_training_load: 60,
        average_watts: 180, average_heartrate: 140, icu_average_watts: 180 },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};

const { fetchRides, ownerLink } = await loadWorker(['fetchRides', 'ownerLink']);

/* This said INTERVALS_ATHELETE for a long time. The misspelling was invisible
   because the code fell back to athlete '0' anyway, which is what the test wanted
   - so the athlete path was never actually under test. It is now, and there is no
   fallback left to hide behind. */
const env = { INTERVALS_KEY: 'secret-key', INTERVALS_ATHLETE: '0' };
/* The real runtime keeps the isolate alive until waitUntil's promise settles.
   Collect them and drain, so the test measures caching rather than a race with
   its own stub. */
const pending = [];
const ctx = { waitUntil: (p) => { pending.push(p); return p; } };
const settle = async () => { await Promise.all(pending.splice(0)); };

/* One request, with its background cache write finished before the next. */
const get = async (a, b, e = env) => { const r = await fetchRides(ownerLink(e), a, b, ctx); await settle(); return r; };

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. The free /ride path: repeated calls for the same day');
upstreamCalls = 0;
const a = await get('2026-08-13', '2026-08-13');
ok(a.ok && a.rides.length === 1, 'first call fetches and returns the ride');
ok(upstreamCalls === 1, `one upstream call so far (${upstreamCalls})`);

/* The week strip: tap day A, day B, back to day A. The client short-circuits on a
   single slot, so all three reach the Worker. */
await get('2026-08-13', '2026-08-13');
await get('2026-08-13', '2026-08-13');
console.log(`   after three identical requests: ${upstreamCalls} upstream call(s)`);
ok(upstreamCalls === 1, 'the repeats are served from cache, not from intervals.icu');

console.log('\n2. A different range is a different key');
await get('2026-08-12', '2026-08-12');
ok(upstreamCalls === 2, `a new day does fetch (${upstreamCalls})`);
await get('2026-08-12', '2026-08-12');
ok(upstreamCalls === 2, 'and is then cached too');

console.log('\n3. The cached body is the fetchRides body, so ?why can reuse it');
const hit = await get('2026-08-13', '2026-08-13');
ok(hit.ok === true && Array.isArray(hit.rides), 'a hit still has ok and rides');
ok(hit.rides[0].load === 60, 'and the ride figures survive the round trip');
ok(typeof hit.fetched === 'string', 'including when it was fetched');

console.log('\n4. The owner key must never be cached or returned');
ok(/Basic /.test(lastAuthHeader || ''), 'upstream call did carry Basic auth');
const cached = [...store.values()].map((v) => v.body).join('');
ok(!cached.includes('secret-key'), 'the stored copy does not contain INTERVALS_KEY');
ok(!JSON.stringify(hit).includes('secret-key'), 'nor does what is returned to the client');

console.log('\n5. A failed upstream must not be cached for ten minutes');
store.clear();
upstreamCalls = 0;
globalThis.fetch = async (url) => {
  if (String(url).includes('intervals.icu')) { upstreamCalls += 1; return new Response('', { status: 429 }); }
  return realFetch(url);
};
const bad = await get('2026-08-01', '2026-08-01');
ok(bad.ok === false && bad.why === 'rate limited', 'a 429 surfaces as {ok:false, rate limited}');
ok(store.size === 0, 'nothing was stored, so the next call can succeed');
const bad2 = await get('2026-08-01', '2026-08-01');
ok(upstreamCalls === 2, 'the retry really does reach upstream again');

console.log('\n6. The ride he just finished must not be held for ten minutes');
/* History can be cached hard; a range reaching today cannot, or the app shows an
   empty day right after a ride syncs. */
store.clear();
globalThis.fetch = async (url, init) => {
  if (String(url).includes('intervals.icu')) {
    upstreamCalls += 1;
    lastAuthHeader = init && init.headers && init.headers.Authorization;
    return new Response(JSON.stringify([
      { id: 'a1', start_date_local: '2026-08-13T07:00:00', name: 'Morning ride',
        moving_time: 3600, distance: 30000, calories: 600, icu_training_load: 60,
        average_watts: 180, average_heartrate: 140, icu_average_watts: 180 },
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, init);
};
const today = new Date().toISOString().slice(0, 10);
const ago = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const maxAge = (a, b, athlete = '0') => {
  const h = store.get(`https://rides.local/${athlete}/${a}/${b}`);
  const m = /max-age=(\d+)/.exec((h && h.headers['cache-control']) || '');
  return m ? Number(m[1]) : null;
};
await get(today, today);
await get(ago(120), ago(90));
const live = maxAge(today, today), done = maxAge(ago(120), ago(90));
console.log(`   today's range: max-age=${live}   a finished range: max-age=${done}`);
ok(live !== null && live <= 60, `a range reaching today is held briefly (${live}s)`);
ok(done !== null && done >= 600, `a finished range is held for the full ten minutes (${done}s)`);
ok(live < done, 'freshness where it matters, caching where it does not');

console.log('\n7. Two athletes are two different cached things');
/* The cache key was the date range alone. One athlete made that invisible; two
   would have made it a cross-tenant read, served from the edge with no upstream
   call to notice it happening. */
store.clear();
upstreamCalls = 0;
let lastUrl = null;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('intervals.icu')) {
    upstreamCalls += 1;
    lastUrl = String(url);
    lastAuthHeader = init && init.headers && init.headers.Authorization;
    return new Response(JSON.stringify([
      { id: 'a1', start_date_local: '2026-08-13T07:00:00', name: 'Morning ride',
        moving_time: 3600, distance: 30000, calories: 600, icu_training_load: 60,
        icu_average_watts: 180 },
    ]), { status: 200, headers: { 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '4321' } });
  }
  return realFetch(url, init);
};

const other = { INTERVALS_KEY: 'secret-key', INTERVALS_ATHLETE: 'i98765' };
const mine = await get('2026-08-13', '2026-08-13');
ok(upstreamCalls === 1, 'the owner fetches once');
ok(/\/athlete\/0\/activities/.test(lastUrl || ''), 'and asks upstream for athlete 0');
await get('2026-08-13', '2026-08-13', other);
ok(upstreamCalls === 2, 'a second athlete over the same dates does NOT get served the first one from cache');
ok(/\/athlete\/i98765\/activities/.test(lastUrl || ''), 'it asks upstream for its own athlete');
ok(store.size === 2, `two athletes, two cache entries (${store.size})`);
const again = await get('2026-08-13', '2026-08-13');
ok(upstreamCalls === 2, "and the owner's entry is still cached separately");

console.log('\n   the remaining allowance is fresh-only, never served stale');
ok(mine.remaining === 4321, `a live fetch reports what upstream said is left (${mine.remaining})`);
ok(again.remaining === undefined, 'a cache hit reports nothing rather than a ten-minute-old number');

console.log('\n8. No link means no rides - never somebody else\'s');
/* athlete=0 means "whoever owns the key". Defaulting to it meant an unlinked
   person would have been quietly handed the owner's rides. There is no default. */
const unlinked = await fetchRides(ownerLink({}), '2026-08-13', '2026-08-13', ctx);
ok(unlinked.ok === false && unlinked.why === 'not linked', 'no key configured is "not linked"');
const before = upstreamCalls;
const junk = await fetchRides(
  ownerLink({ INTERVALS_KEY: 'secret-key', INTERVALS_ATHLETE: '0/../i12345' }), '2026-08-13', '2026-08-13', ctx);
ok(junk.ok === false && junk.why === 'not linked', 'a malformed athlete id is refused rather than sent upstream');
ok(upstreamCalls === before, 'and nothing about that reached intervals.icu');

console.log('\n9. A 429 carries the wait upstream asked for');
globalThis.fetch = async (url) => {
  if (String(url).includes('intervals.icu')) {
    return new Response('', { status: 429, headers: { 'Retry-After': '120' } });
  }
  return realFetch(url);
};
const limited = await get('2026-07-01', '2026-07-01');
ok(limited.why === 'rate limited' && limited.retry === 120, `Retry-After is surfaced, not discarded (${limited.retry})`);

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
