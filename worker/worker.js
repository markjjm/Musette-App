const KEY = 'state:v1';

/* ---- Limits -------------------------------------------------------------
   This is a two-person family list. These ceilings are far above real use
   and exist so a leaked LIST_KEY cannot be turned into unbounded KV growth. */
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

const empty = () => ({ rev: 0, updated: null, plan: null, extras: {}, ticks: {} });

async function load(env) {
  const raw = await env.LIST.get(KEY);
  if (!raw) return empty();
  try {
    const s = JSON.parse(raw);
    return { ...empty(), ...s };
  } catch {
    return empty();
  }
}

async function save(env, state) {
  state.rev = (state.rev || 0) + 1;
  state.updated = new Date().toISOString();
  await env.LIST.put(KEY, JSON.stringify(state));
  return state;
}

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

    if (!env.LIST_KEY) return json({ error: 'LIST_KEY not configured' }, 500, origin);
    if (!(await safeEqual(request.headers.get('X-List-Key') || '', env.LIST_KEY)))
      return json({ error: 'bad or missing X-List-Key' }, 401, origin);

    if (path === '/state' && request.method === 'GET') {
      return json(await load(env), 200, origin);
    }

    if (path === '/state' && request.method === 'PUT') {
      const r = await readJson(request);
      if (r.tooLarge) return json({ error: 'payload too large' }, 413, origin);
      if (r.bad) return json({ error: 'bad json' }, 400, origin);
      const state = await load(env);
      state.ticks = mergeByTime(state.ticks, r.body.ticks, cleanTick);
      state.extras = mergeByTime(state.extras, r.body.extras, cleanExtra);
      return json(await save(env, prune(state)), 200, origin);
    }

    if (path === '/plan' && request.method === 'PUT') {
      if (!env.ADMIN_KEY) return json({ error: 'ADMIN_KEY not configured' }, 500, origin);
      if (!(await safeEqual(request.headers.get('X-Admin-Key') || '', env.ADMIN_KEY)))
        return json({ error: 'bad or missing X-Admin-Key' }, 401, origin);
      const r = await readJson(request);
      if (r.tooLarge) return json({ error: 'payload too large' }, 413, origin);
      if (r.bad) return json({ error: 'bad json' }, 400, origin);
      if (!r.body.plan || !Array.isArray(r.body.plan.weeks))
        return json({ error: 'expected { plan: { weeks: [...] } }' }, 400, origin);
      const state = await load(env);
      state.plan = r.body.plan;
      if (r.body.resetTicks !== false) state.ticks = {};
      return json(await save(env, state), 200, origin);
    }

    return json({ error: 'not found' }, 404, origin);
  },
};
