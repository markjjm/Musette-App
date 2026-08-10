import { DurableObject } from 'cloudflare:workers';

const KEY = 'state:v1';

/* ---- Limits -------------------------------------------------------------
   This is a two-person family list. These ceilings are far above real use
   and exist so a leaked LIST_KEY cannot be turned into unbounded growth. */
const MAX_BODY = 256 * 1024; // bytes of request body
const MAX_ENTRIES = 5000;    // keys per map (ticks / extras)
const MAX_STR = 200;         // chars per user-supplied string
const STORES = new Set(['A', 'M']);

/* Only the deployed app may read responses cross-origin. Auth is by header,
   not cookie, so CORS is defence in depth rather than the primary control. */
const ORIGIN_EXACT = new Set(['https://shopping-list-app-9an.pages.dev']);
const ORIGIN_SUFFIX = '.shopping-list-app-9an.pages.dev'; // Pages preview deploys

function allowedOrigin(origin) {
  if (!origin) return null;
  if (ORIGIN_EXACT.has(origin)) return origin;
  try {
    const u = new URL(origin);
    if (u.protocol === 'https:' && u.hostname.endsWith(ORIGIN_SUFFIX)) return origin;
    /* Local development. Without this `npm run dev:web` cannot talk to the
       deployed Worker at all. The access code is still required, so this only
       widens who may READ a response they were already entitled to. */
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return origin;
  } catch {
    return null;
  }
  return null;
}

function corsHeaders(origin) {
  const allow = allowedOrigin(origin);
  const h = {
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-List-Key,X-Admin-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allow) h['Access-Control-Allow-Origin'] = allow;
  return h;
}

const json = (obj, status = 200, origin = null) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...corsHeaders(origin),
    },
  });

/* Double-HMAC comparison: the digests are compared, so the loop runs over
   fixed-length data and reveals nothing about where the inputs diverged. */
async function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const k = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [da, db] = await Promise.all([
    crypto.subtle.sign('HMAC', k, enc.encode(a)),
    crypto.subtle.sign('HMAC', k, enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = va.length ^ vb.length;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

const empty = () => ({ rev: 0, updated: null, plan: null, extras: {}, ticks: {}, pantry: {} });

const clamp = (v) => (typeof v === 'string' ? v.slice(0, MAX_STR) : '');

/* Accept only the fields we render, with types and lengths enforced.
   Anything unrecognised is dropped rather than stored and echoed back. */
function cleanTick(v) {
  if (!v || typeof v !== 'object' || typeof v.t !== 'number' || !Number.isFinite(v.t)) return null;
  return { v: v.v === true, t: v.t };
}

function cleanExtra(v) {
  if (!v || typeof v !== 'object' || typeof v.t !== 'number' || !Number.isFinite(v.t)) return null;
  const cost = Number(v.cost);
  const out = {
    name: clamp(v.name),
    qty: clamp(v.qty),
    cost: Number.isFinite(cost) ? Math.max(0, Math.min(cost, 100000)) : 0,
    store: STORES.has(v.store) ? v.store : 'A',
    week: clamp(v.week),
    t: v.t,
  };
  if (v.deleted) out.deleted = true;
  return out;
}

/* Pantry staples carry a standing state that is NOT week-scoped: mark the
   peanut butter low and it stays low until someone buys it. */
const PANTRY_STATES = new Set(['ok', 'low', 'out']);
function cleanPantry(v) {
  if (!v || typeof v !== 'object' || typeof v.t !== 'number' || !Number.isFinite(v.t)) return null;
  if (!PANTRY_STATES.has(v.s)) return null;
  return { s: v.s, t: v.t };
}

/* Last-write-wins per key, using each entry's own timestamp. */
function mergeByTime(mine, theirs, clean) {
  const out = { ...mine };
  if (!theirs || typeof theirs !== 'object') return out;
  let budget = MAX_ENTRIES;
  for (const [k, raw] of Object.entries(theirs)) {
    if (budget-- <= 0) break;
    if (k.length > MAX_STR) continue;
    const v = clean(raw);
    if (!v) continue;
    const cur = out[k];
    if (!cur || typeof cur.t !== 'number' || v.t > cur.t) out[k] = v;
  }
  return out;
}

/* Drop unticked items and deleted extras older than 90 days. */
function prune(state) {
  const cutoff = Date.now() - 90 * 86400000;
  for (const [k, v] of Object.entries(state.ticks)) {
    if (v.t < cutoff && v.v === false) delete state.ticks[k];
  }
  for (const [k, v] of Object.entries(state.extras)) {
    if (v.deleted && v.t < cutoff) delete state.extras[k];
  }
  return state;
}

/* ---- The list itself ----------------------------------------------------
   One Durable Object owns the whole list. Cloudflare runs at most one
   request at a time against a given object, and blockConcurrencyWhile makes
   each read-modify-write indivisible. That is the entire reason this class
   exists: the previous version did load() -> merge -> put() against a KV
   blob with no compare-and-swap, so two phones syncing in the same second
   silently lost one side's changes. Measured at 60-85% loss under
   concurrency. A shared family list has to be the source of truth. */
export class ListDO extends DurableObject {
  async load() {
    let s = await this.ctx.storage.get('state');
    if (!s) {
      /* One-time adoption of the old KV blob so nothing is lost in the move. */
      let seeded = null;
      try {
        const raw = await this.env.LIST.get(KEY);
        if (raw) seeded = JSON.parse(raw);
      } catch {
        seeded = null;
      }
      s = seeded && typeof seeded === 'object' ? seeded : empty();
      await this.ctx.storage.put('state', s);
    }
    return { ...empty(), ...s };
  }

  async read() {
    return await this.load();
  }

  /* Just the revision number. Phones poll this every few seconds while the app
     is on screen; it is a handful of bytes, versus ~100 KB for the full state,
     so the list only gets pulled when it has actually changed. */
  async rev() {
    const s = await this.ctx.storage.get('state');
    return { rev: (s && s.rev) || 0, updated: (s && s.updated) || null };
  }

  async merge(body) {
    return await this.ctx.blockConcurrencyWhile(async () => {
      const state = await this.load();
      const prev = JSON.parse(JSON.stringify(state));
      state.ticks = mergeByTime(state.ticks, body.ticks, cleanTick);
      state.extras = mergeByTime(state.extras, body.extras, cleanExtra);
      state.pantry = mergeByTime(state.pantry, body.pantry, cleanPantry);
      prune(state);
      /* One-deep undo. Writes are unauthenticated, so keep the previous good
         state to roll back to rather than relying on nobody ever scribbling. */
      await this.ctx.storage.put('prev', prev);
      state.rev = (state.rev || 0) + 1;
      state.updated = new Date().toISOString();
      await this.ctx.storage.put('state', state);
      return state;
    });
  }

/* Failed-attempt throttle, counted here rather than with the platform rate
     limiter. The [[ratelimits]] binding deploys and reports correctly but did
     not actually limit anything in testing — 20 wrong codes in a row all came
     back 401 with no 429. This object already serialises every request, so it
     can count reliably, and the behaviour is testable. Only wrong codes reach
     it; a correct code never pays this cost. */
  async noteFailure(ip) {
    return await this.ctx.blockConcurrencyWhile(async () => {
      const NOW = Date.now(), WINDOW = 60000, MAX = 10;
      const all = (await this.ctx.storage.get('fails')) || {};
      const fresh = (all[ip] || []).filter(t => NOW - t < WINDOW);
      if (fresh.length >= MAX) {
        all[ip] = fresh;                     // already blocked: stop growing it
        await this.ctx.storage.put('fails', all);
        return { blocked: true, tries: fresh.length };
      }
      fresh.push(NOW);
      all[ip] = fresh;
      for (const k of Object.keys(all)) {    // never let other IPs accumulate
        all[k] = all[k].filter(t => NOW - t < WINDOW);
        if (!all[k].length) delete all[k];
      }
      await this.ctx.storage.put('fails', all);
      return { blocked: false, tries: fresh.length };
    });
  }

  async undo() {
    return await this.ctx.blockConcurrencyWhile(async () => {
      const prev = await this.ctx.storage.get('prev');
      if (!prev) return { ...empty(), error: 'nothing to undo' };
      const restored = { ...empty(), ...prev, rev: (prev.rev || 0) + 1, updated: new Date().toISOString() };
      await this.ctx.storage.put('state', restored);
      return restored;
    });
  }

  async setPlan(plan, resetTicks) {
    return await this.ctx.blockConcurrencyWhile(async () => {
      const state = await this.load();
      state.plan = plan;
      if (resetTicks !== false) state.ticks = {};
      state.rev = (state.rev || 0) + 1;
      state.updated = new Date().toISOString();
      await this.ctx.storage.put('state', state);
      return state;
    });
  }
}

async function readJson(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY) return { tooLarge: true };
  const text = await request.text();
  if (text.length > MAX_BODY) return { tooLarge: true };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { bad: true };
    return { body };
  } catch {
    return { bad: true };
  }
}

/* One household, one list, so one object. */
const listStub = (env) => env.LIST_DO.get(env.LIST_DO.idFromName('household'));

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    /* Rate limit before any secret comparison, so an unauthenticated caller
       cannot grind through LIST_KEY guesses. Optional binding: the Worker
       still functions correctly if RL is not configured. */
    if (env.RL) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      try {
        const { success } = await env.RL.limit({ key: ip });
        if (!success) return json({ error: 'rate limited' }, 429, origin);
      } catch {
        /* limiter unavailable - fail open rather than lock the family out */
      }
    }

    if (path === '/health') return json({ ok: true }, 200, origin);

    /* Open by design: this household chose an unauthenticated family list.
       The gate is not deleted, it is conditional — set a LIST_KEY secret and
       it is enforced again, no code change:
           npx wrangler secret put LIST_KEY --config worker/wrangler.toml
       Deleting the secret reopens it. /plan stays behind ADMIN_KEY either way,
       because replacing the whole meal plan is the one destructive operation. */
    /* Fail CLOSED. Inferring "open" from a missing secret meant that during
       secret propagation — or any accidental deletion — the list silently
       served to anyone. Observed once in testing: a request landed on a colo
       that had not received LIST_KEY yet and was allowed straight through.
       Open access now has to be asked for explicitly. */
    const openList = env.OPEN_LIST === 'yes';
    if (!openList) {
      if (!env.LIST_KEY)
        return json({ error: 'access code not configured' }, 503, origin);
      if (!(await safeEqual(request.headers.get('X-List-Key') || '', env.LIST_KEY))) {
        /* The access code is short by design — four digits typed on a phone.
           That is only defensible if guessing is slow, so a WRONG code costs an
           attempt from a much tighter per-IP budget than ordinary traffic.
           Legitimate use never touches this limiter, because it only runs on a
           failure. Without it, 10,000 combinations fall in minutes. */
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const gate = await listStub(env).noteFailure(ip);
        if (gate.blocked) return json({ error: 'too many attempts, wait a minute' }, 429, origin);
        return json({ error: 'bad or missing access code' }, 401, origin);
      }
    }

    if (path === '/rev' && request.method === 'GET') {
      return json(await listStub(env).rev(), 200, origin);
    }

    if (path === '/state' && request.method === 'GET') {
      return json(await listStub(env).read(), 200, origin);
    }

    if (path === '/state' && request.method === 'PUT') {
      const r = await readJson(request);
      if (r.tooLarge) return json({ error: 'payload too large' }, 413, origin);
      if (r.bad) return json({ error: 'bad json' }, 400, origin);
      return json(await listStub(env).merge(r.body), 200, origin);
    }

    if (path === '/undo' && request.method === 'PUT') {
      if (!env.ADMIN_KEY) return json({ error: 'ADMIN_KEY not configured' }, 500, origin);
      if (!(await safeEqual(request.headers.get('X-Admin-Key') || '', env.ADMIN_KEY)))
        return json({ error: 'bad or missing X-Admin-Key' }, 401, origin);
      return json(await listStub(env).undo(), 200, origin);
    }

    if (path === '/plan' && request.method === 'PUT') {
      if (!env.ADMIN_KEY) return json({ error: 'ADMIN_KEY not configured' }, 500, origin);
      if (!(await safeEqual(request.headers.get('X-Admin-Key') || '', env.ADMIN_KEY)))
        return json({ error: 'bad or missing X-Admin-Key' }, 401, origin);
      const r = await readJson(request);
      if (r.tooLarge) return json({ error: 'payload too large' }, 413, origin);
      if (r.bad) return json({ error: 'bad json' }, 400, origin);
      /* Reject a weekless plan at the source too: storing one would blank every
         phone that synced it, and the only way back would be /undo. */
      if (!r.body.plan || !Array.isArray(r.body.plan.weeks) || !r.body.plan.weeks.length)
        return json({ error: 'expected { plan: { weeks: [ ...at least one ] } }' }, 400, origin);
      return json(await listStub(env).setPlan(r.body.plan, r.body.resetTicks), 200, origin);
    }

    return json({ error: 'not found' }, 404, origin);
  },
};
