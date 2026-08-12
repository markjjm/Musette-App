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

const empty = () => ({ rev: 0, updated: null, plan: null, extras: {}, ticks: {}, pantry: {}, log: {} });

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

/* What was actually eaten, as opposed to what was planned. Keyed by date and
   meal time — '2026-08-12|6:15 am' — so it is anchored to a real day rather
   than to a week id, and so a key can never collide with a tick key, which is
   'weekId|itemname'. Value is how much of the meal was eaten: 0, a half, or
   all of it. Nothing finer, because nobody is weighing their dinner. */
const ATE = new Set([0, 0.5, 1]);
function cleanLog(v) {
  if (!v || typeof v !== 'object' || typeof v.t !== 'number' || !Number.isFinite(v.t)) return null;
  const n = Number(v.v);
  if (!ATE.has(n)) return null;
  return { v: n, t: v.t };
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
  /* One key per meal per day is roughly 210 a month, so a year of history would
     pass MAX_ENTRIES on its own. Nothing reads a meal log from three months ago. */
  for (const [k, v] of Object.entries(state.log || {})) {
    if (v.t < cutoff) delete state.log[k];
  }
  return state;
}

/* ---- The coach ----------------------------------------------------------
   Everything numeric is computed here, in code, and handed to the model as
   settled fact. The model is asked for judgement only: given that the day is
   370 kcal short, what should change about dinner?

   This is not fastidiousness. Asked to work out that same 370 from its parts,
   gpt-5-mini at minimal effort answered -88 — confidently, in valid JSON,
   against a schema that had no way to notice. Arithmetic a pocket calculator
   cannot get wrong has no business going to a language model, and a wrong
   number here would be indistinguishable from a right one. */
const COACH_MODEL = 'gpt-5-mini';
const COACH_EFFORT = 'low';   // minimal cannot do the sums; medium buys nothing here
const COACH_MAX_DAY = 40;     // hard ceiling on calls per UTC day

const COACH_SYSTEM = [
  'You advise one cyclist: 67.1 kg, riding to hold weight steady — neither gaining nor losing.',
  '',
  'Every number in the payload has already been computed and verified. Treat each as settled fact.',
  'Never recalculate one, never contradict one, and never introduce a number that is not derivable',
  'from those given. If something needed is missing, say so in `detail` rather than estimating it.',
  '',
  'Your job is judgement, not arithmetic: given these facts, what should change about the meals',
  'still to come today? Rules:',
  '- `changes` must be a set of edits applied TOGETHER, never alternatives. Their kcal_delta must',
  '  sum to about `gap_kcal`. If you would rather offer a choice, pick one and say why in `detail`.',
  '- Return an empty `changes` array when the day is close enough. That is a good answer, not a',
  '  failure — a gap under about 150 kcal is noise against any estimate of what someone burned.',
  '- Prefer changing food already planned over adding new food. Respect anything listed as low in',
  '  the pantry: do not build a suggestion around it.',
  '- Ride fuel is deliberate. Leave pre-ride, on-the-bike and recovery alone unless the ride itself',
  '  came in very differently from plan.',
  '',
  'Be brief and concrete. This is read on a phone, mid-afternoon, by someone deciding what to cook.',
  'You are not a clinician: no medical advice, no diagnosis, nothing about disordered eating.',
].join('\n');

const ANALYST_SYSTEM = [
  'You read training data for one cyclist: 67.1 kg, riding to hold weight steady, on a 31-day',
  'August block. He has a power meter, so the power figures are measured rather than estimated.',
  '',
  'Every number below is already computed. Never recalculate one and never invent one.',
  '',
  'Write the read on his training that a good coach would give — specific to him, not the generic',
  'summary a tracking site produces. What has actually been happening, what it means, and what he',
  'should do about it. Rules:',
  '- Say what the data supports and no more. Two weeks is a trend to watch, not a conclusion.',
  '  Say so plainly when the sample is thin rather than dressing it up.',
  '- watts_per_bpm is the fitness signal worth the most: more power at the same heart rate.',
  '  A move under about 2% is noise.',
  '- Riding fewer hours than planned is information, not a failing. If he consistently rides less',
  '  than the block asks, the block is wrong, not him — say that, because his food is calculated',
  '  from planned hours and he will be over-fed by the difference.',
  '- Be concrete: name the week, the number, the day.',
  '- No medical advice, no diagnosis, nothing about disordered eating.',
  '',
  'Write to a person, not to a data dictionary. Never name a field from the payload and never',
  'cite where a number was stored: no "(the_day)", no "(ride file)", no "(logging_note)",',
  'no "(versus_his_own_history)", no "(Figure: ...)". Say "the plan", "your ride", "what you',
  'logged". Give the number; never give its address.',
].join('\n');

/* Open-ended on purpose. An earlier version had four fixed slots — fitness,
   consistency, watch, next — and got four paragraphs whether or not there were
   four things worth saying. Now the sections are chosen by whoever is reading
   the data, so a quiet month is allowed to be two sections and an interesting
   one can be six. */
const ANALYST_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One sentence: the most important thing here.' },
    sections: {
      type: 'array',
      description: 'Between two and six. Choose the headings the data actually calls for — do not pad to a quota, and do not merge two real findings to stay under one.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Two or three words, sentence case.' },
          body: { type: 'string', description: 'A short paragraph. Cite the figure and the week or day it came from.' },
        },
        required: ['title', 'body'],
        additionalProperties: false,
      },
    },
    do_next: { type: 'array', description: 'Nought to three concrete actions. Empty is allowed when nothing needs changing.', items: { type: 'string' } },
    caveat: { type: 'string', description: 'What this data cannot tell him.' },
  },
  required: ['headline', 'sections', 'do_next', 'caveat'],
  additionalProperties: false,
};

/* One ride, read against every other ride he has done. The point of difference
   from a tracking site is the last two blocks of this prompt: it knows what the
   day was supposed to be, and it knows what he ate. */
const RIDE_SYSTEM = [
  'You read a single ride for one cyclist: 67.1 kg, riding to hold weight steady, mid-block.',
  'He has a power meter, so power is measured rather than estimated.',
  '',
  'Every number is already computed, including the percentiles that place this ride against his',
  'own history. Never recalculate one, never invent one.',
  '',
  'Tell him what this ride actually was. Two things make this worth reading over a tracking site,',
  'so lead with them when the data supports it:',
  '- Where it sits against HIS OWN riding, not a population. The percentiles are given.',
  '- How it met the day: what was planned, what he ate, and whether the fuelling fitted the effort.',
  '',
  'Rules: say what the data supports and no more. watts_per_bpm is the fitness signal — more power',
  'at the same heart rate — and a move under about 2% is noise. A short ride is not a bad ride;',
  'say so rather than manufacturing a concern. If nothing here is notable, the honest answer is',
  'that it was an ordinary ride that went to plan, and you should give it.',
  'No medical advice, no diagnosis, nothing about disordered eating.',
  '',
  'Write to a person, not to a data dictionary. Never name a field from the payload and never',
  'cite where a number was stored: no "(the_day)", no "(ride file)", no "(logging_note)",',
  'no "(versus_his_own_history)", no "(Figure: ...)". Say "the plan", "your ride", "what you',
  'logged". Give the number; never give its address.',
].join('\n');

const COACH_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One sentence, the whole answer if they read nothing else.' },
    detail: { type: 'string', description: 'Two or three sentences of reasoning. Plain language.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    changes: {
      type: 'array',
      description: 'Edits to apply together. Empty means no change needed.',
      items: {
        type: 'object',
        properties: {
          meal: { type: 'string', description: 'Which meal, named exactly as given in remaining_meals.' },
          change: { type: 'string', description: 'What to do, concretely enough to act on.' },
          kcal_delta: { type: 'integer', description: 'Signed change in calories for this meal.' },
        },
        required: ['meal', 'change', 'kcal_delta'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'detail', 'confidence', 'changes'],
  additionalProperties: false,
};

/* '6:15 am' -> 375. Meal times are authored, not user input, but a plan that
   ever carried a malformed one should push the meal to the end of the day
   rather than to the start of it. */
function minsOf(t) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(t || '').trim());
  if (!m) return 24 * 60;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

/* Assemble what the model is allowed to know. Every figure below is arithmetic
   done here; none of it is left for the model to work out. */
function coachFacts(state, rides, dayNum, nowMins) {
  const plan = state.plan || {};
  const day = (plan.days || []).find((d) => d.d === dayNum);
  const train = (plan.training || []).find((t) => t.d === dayNum);
  if (!day) return null;

  const ridden = rides.reduce((a, r) => a + (r.secs || 0), 0) / 3600;
  const burned = rides.reduce((a, r) => a + (r.kcal || 0), 0);
  const measured = rides.length > 0 && rides.every((r) => r.trust === 'measured');

  const done = day.meals.filter((m) => minsOf(m.t) <= nowMins);
  const left = day.meals.filter((m) => minsOf(m.t) > nowMins);
  const onBike = (train && train.bk && train.bk.kc) || 0;

  /* What the plan already budgeted for riding, against what the ride cost.
     Both are whole-ride figures, so they are comparable; on-bike intake is
     reported separately and is deliberately not subtracted from either. */
  const plannedBurn = Math.round((train && train.h ? train.h : 0) * 600);
  const gap = rides.length ? Math.round(burned - plannedBurn) : 0;

  return {
    date: `2026-08-${String(dayNum).padStart(2, '0')}`,
    weekday: day.wd,
    day_type: day.kind,
    rider_kg: 67.1,
    goal: 'hold weight steady',

    planned_ride_h: train ? train.h : 0,
    actual_ride_h: Math.round(ridden * 100) / 100,
    planned_burn_kcal: plannedBurn,
    actual_burn_kcal: Math.round(burned),
    gap_kcal: gap,
    burn_is_measured: measured,
    planned_onbike_intake_kcal: onBike,

    day_target_kcal: day.kc,
    day_target_carb_g: day.cb,
    eaten_so_far_kcal: done.reduce((a, m) => a + m.kc, 0),
    remaining_planned_kcal: left.reduce((a, m) => a + m.kc, 0),
    remaining_meals: left.map((m) => `${m.t} ${m.l} — ${m.kc} kcal`),
    already_eaten: done.map((m) => m.l),

    pantry_low: Object.entries(state.pantry || {})
      .filter(([, v]) => v && (v.s === 'low' || v.s === 'out'))
      .map(([k]) => k)
      .slice(0, 20),
  };
}

/* Where one ride sits in his own history. A tracking site compares you to
   everyone; the only useful comparison is to yourself. */
function rideContext(ride, all, day, meals, logMap, dateISO) {
  const pool = all.filter((r) => (r.kcal || 0) > 0 && r.date !== ride.date);
  const pct = (val, pick) => {
    const xs = pool.map(pick).filter((x) => typeof x === 'number' && x > 0).sort((a, b) => a - b);
    if (xs.length < 4 || typeof val !== 'number' || !val) return null;
    let below = 0;
    for (const x of xs) if (x < val) below += 1;
    return Math.round((below / xs.length) * 100);
  };
  const eaten = (meals || []).reduce((a, m) => {
    const e = logMap[dateISO + '|' + m.t];
    return a + m.kc * (e ? Number(e.v) || 0 : 0);
  }, 0);
  const anyLogged = (meals || []).some((m) => logMap[dateISO + '|' + m.t]);

  /* Deliberately flat. An earlier version nested this under `ride`,
     `the_day` and `versus_his_own_history`, and the model cited those names
     back at the reader as though they were sources — "(the_day)". Telling it
     not to did not work; twice. With no container names in the payload there
     is nothing to cite, which is the difference between asking for a
     behaviour and making the other one unavailable. */
  return {
    what_it_was: ride.name,
    activity_type: ride.type,
    on_date: ride.date,
    minutes: Math.round(ride.secs / 60),
    kilometres: ride.km,
    climb_metres: ride.up,
    calories_burned: ride.kcal,
    calories_came_from: ride.basis,
    average_watts: ride.watts,
    normalised_watts: ride.np,
    average_heart_rate: ride.hr,
    training_load: ride.load,
    watts_per_heartbeat: ride.pwhr,

    compared_against_how_many_of_his_rides: pool.length,
    harder_than_this_percent_on_calories: pct(ride.kcal, (r) => r.kcal),
    longer_than_this_percent: pct(ride.secs, (r) => r.secs),
    more_powerful_than_this_percent: pct(ride.watts, (r) => r.watts),
    higher_load_than_this_percent: pct(ride.load, (r) => r.load),
    better_watts_per_heartbeat_than_this_percent: pct(ride.pwhr, (r) => r.pwhr),

    day_was_planned_as: day ? day.kind : null,
    planned_ride_hours: day ? day.h : null,
    planned_ride_calories: day ? Math.round((day.h || 0) * 600) : null,
    planned_food_calories_for_the_day: day ? day.kc : null,
    planned_carb_grams_for_the_day: day ? day.cb : null,
    planned_carb_grams_on_the_bike: null,
    calories_he_ticked_off_eating: anyLogged ? Math.round(eaten) : null,
    did_he_log_his_food: anyLogged
      ? 'yes, so the eaten figure is real'
      : 'no, so what he ate is unknown and must not be assumed to match the plan',
  };
}

/* Strips citation-shaped parentheticals — "(the_day)", "(ride data)" — while
   leaving real ones like "(81st percentile)" alone. Prompting against this
   failed twice, and a deterministic pass cannot fail a third time. */
const CITE = /\s*\((?:[a-z][a-z0-9]*_[a-z0-9_]*(?:\s*[\/,]\s*[a-z0-9_]+)*|ride data|ride file|Figure:[^)]*)\)/gi;
const scrub = (v) => String(v == null ? '' : v).replace(CITE, '').replace(/\s{2,}/g, ' ').trim();

function scrubAdvice(a) {
  if (!a || typeof a !== 'object') return a;
  if (typeof a.headline === 'string') a.headline = scrub(a.headline);
  if (typeof a.caveat === 'string') a.caveat = scrub(a.caveat);
  if (typeof a.detail === 'string') a.detail = scrub(a.detail);
  if (Array.isArray(a.do_next)) a.do_next = a.do_next.map(scrub);
  if (Array.isArray(a.sections)) a.sections = a.sections.map((s) => ({ title: scrub(s.title), body: scrub(s.body) }));
  if (Array.isArray(a.changes)) a.changes = a.changes.map((c) => ({ ...c, change: scrub(c.change), meal: scrub(c.meal) }));
  return a;
}

/* Never throws. A coach that is down must not take the meal plan with it. */
async function askModel(env, system, schema, name, facts) {
  if (!env.OPENAI_KEY) return { ok: false, why: 'not configured' };
  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: COACH_MODEL,
        reasoning: { effort: COACH_EFFORT },
        input: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(facts) },
        ],
        text: { format: { type: 'json_schema', name, schema, strict: true } },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (r.status === 429) return { ok: false, why: 'rate limited' };
    if (r.status === 401) return { ok: false, why: 'key rejected' };
    if (!r.ok) return { ok: false, why: `upstream ${r.status}` };
    const d = await r.json();
    if (d.error) return { ok: false, why: 'upstream error' };
    /* A truncated answer is still valid JSON against the schema, so status has
       to be checked rather than inferred from the body parsing cleanly. */
    if (d.status === 'incomplete')
      return { ok: false, why: (d.incomplete_details && d.incomplete_details.reason) || 'incomplete' };

    let text = null;
    for (const item of d.output || []) {
      if (item.type !== 'message') continue;           // the first item is reasoning, and is empty
      for (const c of item.content || []) {
        if (c.type === 'refusal') return { ok: false, why: 'declined' };
        if (c.type === 'output_text') text = c.text;
      }
    }
    if (!text) return { ok: false, why: 'empty response' };
    const out = JSON.parse(text);
    const u = d.usage || {};
    return {
      ok: true,
      advice: scrubAdvice(out),
      cost: Math.round(((u.input_tokens || 0) * 0.25 + (u.output_tokens || 0) * 2.0) / 10) / 100000,
      model: d.model || COACH_MODEL,
    };
  } catch {
    return { ok: false, why: 'unreachable' };
  }
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
      state.log = mergeByTime(state.log || {}, body.log, cleanLog);
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

  /* The coach is the first endpoint here that spends real money, which makes it
     the first one where an attacker's goal could be the bill rather than the
     list. The access code is four digits; that is a deliberate, documented
     trade for a grocery list, but it is not a budget control. So the budget is
     enforced separately, and counted in the object that already serialises
     every request. Stored under its own key — `read()` returns `state`
     wholesale, so nothing private may live there. */
  async spend(day) {
    return await this.ctx.blockConcurrencyWhile(async () => {
      const s = (await this.ctx.storage.get('spend')) || {};
      if (s.day !== day) { s.day = day; s.n = 0; }
      if (s.n >= COACH_MAX_DAY) return { ok: false, n: s.n };
      s.n += 1;
      await this.ctx.storage.put('spend', s);
      return { ok: true, n: s.n };
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

/* ---- Rides, via intervals.icu ------------------------------------------
   The plan says how hard a day was *meant* to be. This says how hard it
   actually was, so the two can be compared.

   intervals.icu rather than Strava or Garmin, for three reasons that are not
   about technology: Garmin's Connect Developer Program is enterprise-only and
   has paused new access entirely; Strava now requires a paid subscription to
   create an app, and its API policy forbids passing ride data to an AI, which
   is the whole point of what comes next. intervals.icu issues a personal API
   key from a settings page, and imports from Garmin and Strava anyway — so the
   data still arrives from whatever the ride was actually recorded on.

   The key is a Worker secret. It is never sent to the page, and the page has
   no way to reach intervals.icu directly: connect-src in the CSP names only
   this Worker. */
const ICU = 'https://intervals.icu/api/v1';

/* Only the columns that matter here. The full activity object carries 183
   fields, which is a lot to push at a phone on mobile data. */
const ICU_FIELDS = [
  'id', 'start_date_local', 'type', 'name', 'moving_time', 'elapsed_time',
  'distance', 'total_elevation_gain', 'icu_joules', 'calories', 'device_watts',
  'icu_average_watts', 'icu_weighted_avg_watts', 'average_heartrate',
  'max_heartrate', 'icu_training_load', 'icu_power_hr', 'icu_intensity',
].join(',');

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

/* How many calories a ride actually cost, and how much to trust the number.

   With a power meter the answer is close to free: `icu_joules` is measured
   mechanical work, and a cyclist converts food to pedals at roughly 20-25%
   efficiency. The reciprocal of that lands near 4.18 — the same number that
   converts kJ to kcal — so the two cancel and work in kJ is within a few
   percent of energy burned in kcal. That coincidence is why power-meter riders
   read kJ as calories directly.

   Without a power meter every remaining option is an estimate, and is labelled
   as one rather than being quietly mixed in with measurements. */
function rideEnergy(a) {
  const kj = Math.round((Number(a.icu_joules) || 0) / 1000);
  if (kj > 0) {
    return a.device_watts === true
      ? { kcal: kj, basis: 'power meter', trust: 'measured' }
      : { kcal: kj, basis: 'estimated power', trust: 'estimated' };
  }
  const cal = Number(a.calories) || 0;
  if (cal > 0) return { kcal: Math.round(cal), basis: 'device estimate', trust: 'estimated' };
  return { kcal: null, basis: 'no energy data', trust: 'none' };
}

function cleanRide(a) {
  const e = rideEnergy(a);
  return {
    id: String(a.id || '').slice(0, MAX_STR),
    date: String(a.start_date_local || '').slice(0, 10),
    type: clamp(a.type),
    name: clamp(a.name),
    secs: Number(a.moving_time) || 0,
    km: Math.round(((Number(a.distance) || 0) / 1000) * 10) / 10,
    up: Math.round(Number(a.total_elevation_gain) || 0),
    kcal: e.kcal,
    basis: e.basis,
    trust: e.trust,
    watts: Number(a.icu_average_watts) || null,
    np: Number(a.icu_weighted_avg_watts) || null,
    hr: Number(a.average_heartrate) || null,
    load: Number(a.icu_training_load) || null,
    /* Watts per heartbeat. Rising over weeks at the same heart rate is the
       cleanest cheap signal that aerobic fitness is actually improving. */
    pwhr: a.icu_power_hr ? Math.round(Number(a.icu_power_hr) * 1000) / 1000 : null,
    intensity: Number(a.icu_intensity) || null,
  };
}

/* Weekly shape of the last N weeks. Every figure here is arithmetic; the model
   is handed the finished table and asked what it means. */
function trainingStats(rides, plan, todayISO) {
  const wk = new Map();
  const key = (iso) => {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));   // back to Monday
    return d.toISOString().slice(0, 10);
  };
  for (const r of rides) {
    if (!r.date) continue;
    const k = key(r.date);
    const w = wk.get(k) || { week: k, rides: 0, secs: 0, kcal: 0, load: 0, wsum: 0, hsum: 0, phsum: 0, n: 0, days: new Set() };
    w.rides += 1; w.secs += r.secs || 0; w.kcal += r.kcal || 0; w.load += r.load || 0;
    w.days.add(r.date);
    if (r.watts && r.hr) { w.wsum += r.watts; w.hsum += r.hr; w.phsum += r.pwhr || (r.watts / r.hr); w.n += 1; }
    wk.set(k, w);
  }
  const weeks = [...wk.values()].sort((a, b) => a.week < b.week ? -1 : 1).map((w) => ({
    week: w.week,
    ride_days: w.days.size,
    rides: w.rides,
    hours: Math.round((w.secs / 3600) * 10) / 10,
    kcal: Math.round(w.kcal),
    load: Math.round(w.load),
    avg_watts: w.n ? Math.round(w.wsum / w.n) : null,
    avg_hr: w.n ? Math.round(w.hsum / w.n) : null,
    /* Rounded to 3dp because the interesting movement here is in the second. */
    watts_per_bpm: w.n ? Math.round((w.phsum / w.n) * 1000) / 1000 : null,
  }));

  /* The week in progress is not comparable with finished ones: on a Wednesday
     it holds two rides against a full week's five, which drags every average
     down and reads as a collapse in form. Mark it, and keep it out of the
     trend. The model caught this on its own once; it should not have to. */
  const thisWeek = key(todayISO);
  for (const w of weeks) if (w.week === thisWeek) w.partial = true;

  const complete = weeks.filter((w) => !w.partial);
  const recent = complete.slice(-4);
  const eff = recent.filter((w) => w.watts_per_bpm);
  const trend = eff.length >= 2
    ? Math.round(((eff[eff.length - 1].watts_per_bpm - eff[0].watts_per_bpm) / eff[0].watts_per_bpm) * 1000) / 10
    : null;

  /* Adherence: planned hours in the block against hours actually ridden, for
     days that have already happened. */
  const today = Number(todayISO.slice(8, 10));
  let planH = 0, planDays = 0;
  for (const t of (plan && plan.training) || []) {
    if (t.d < today && (t.h || 0) > 0) { planH += t.h; planDays += 1; }
  }
  const inBlock = rides.filter((r) => r.date >= '2026-08-01' && r.date < todayISO);
  const realH = inBlock.reduce((a, r) => a + (r.secs || 0), 0) / 3600;
  const realDays = new Set(inBlock.map((r) => r.date)).size;

  return {
    weeks,
    weeks_counted: weeks.length,
    current_week_partial: true,
    trend_uses_complete_weeks_only: true,
    last_4_weeks_hours: Math.round(recent.reduce((a, w) => a + w.hours, 0) * 10) / 10,
    last_4_weeks_load: recent.reduce((a, w) => a + w.load, 0),
    efficiency_trend_pct: trend,
    efficiency_note: 'watts_per_bpm rising means more power at the same heart rate',
    block_planned_hours: Math.round(planH * 10) / 10,
    block_actual_hours: Math.round(realH * 10) / 10,
    block_planned_ride_days: planDays,
    block_actual_ride_days: realDays,
    longest_ride_kcal: inBlock.reduce((a, r) => Math.max(a, r.kcal || 0), 0),
  };
}

/* Never throws, and never returns an error that would stop the page rendering.
   A meal plan must not stop working because a fitness site is having a bad
   day, so every failure here degrades to "no ride data" and the app carries on
   showing the plan. */
async function fetchRides(env, oldest, newest) {
  if (!env.INTERVALS_KEY) return { ok: false, why: 'not linked' };
  const athlete = env.INTERVALS_ATHLETE || '0'; // 0 means "whoever owns the key"
  const q = new URLSearchParams({ oldest, newest, fields: ICU_FIELDS });
  const auth = btoa(`API_KEY:${env.INTERVALS_KEY}`);
  try {
    const r = await fetch(`${ICU}/athlete/${encodeURIComponent(athlete)}/activities?${q}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401 || r.status === 403) return { ok: false, why: 'key rejected' };
    if (r.status === 429) return { ok: false, why: 'rate limited' };
    if (!r.ok) return { ok: false, why: `upstream ${r.status}` };
    const raw = await r.json();
    if (!Array.isArray(raw)) return { ok: false, why: 'unexpected response' };
    const rides = raw.filter((a) => a && a.id).slice(0, 200).map(cleanRide);
    return { ok: true, rides, fetched: new Date().toISOString() };
  } catch {
    /* Timeout, DNS, TLS — all the same to the caller. */
    return { ok: false, why: 'unreachable' };
  }
}

export default {
  async fetch(request, env, ctx) {
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

    /* What was actually ridden, to sit beside what was planned. Behind the
       access code like everything else — it is the same household — but the
       intervals.icu key itself stays in the Worker and is never returned.

       Cached at the edge for ten minutes. Rides do not change after the fact,
       and both phones polling `/rev` every four seconds must not turn into
       traffic against someone else's API. */
    if (path === '/rides' && request.method === 'GET') {
      const oldest = url.searchParams.get('oldest') || '';
      const newest = url.searchParams.get('newest') || '';
      if (!isDate(oldest) || !isDate(newest))
        return json({ ok: false, why: 'expected oldest and newest as YYYY-MM-DD' }, 400, origin);

      const key = new Request(`https://rides.local/${oldest}/${newest}`);
      const cache = caches.default;
      const hit = await cache.match(key);
      if (hit) return new Response(hit.body, { status: 200, headers: { ...Object.fromEntries(hit.headers), ...corsHeaders(origin) } });

      const body = await fetchRides(env, oldest, newest);
      const res = json(body, 200, origin);
      if (body.ok) {
        const copy = new Response(JSON.stringify(body), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=600' },
        });
        ctx.waitUntil(cache.put(key, copy));
      }
      return res;
    }

    if (path === '/state' && request.method === 'GET') {
      return json(await listStub(env).read(), 200, origin);
    }

    /* Today's plan, today's actual riding, and one piece of judgement about
       what to do with the difference. The arithmetic is all done above; the
       model only ever sees finished numbers. */
    if (path === '/coach' && request.method === 'GET') {
      const date = url.searchParams.get('date') || '';
      const hhmm = url.searchParams.get('now') || '';
      if (!isDate(date)) return json({ ok: false, why: 'expected date=YYYY-MM-DD' }, 400, origin);
      const t = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
      if (!t) return json({ ok: false, why: 'expected now=HH:MM local' }, 400, origin);
      const nowMins = Number(t[1]) * 60 + Number(t[2]);
      if (!(nowMins >= 0 && nowMins < 1440)) return json({ ok: false, why: 'bad now' }, 400, origin);

      const budget = await listStub(env).spend(date);
      if (!budget.ok) return json({ ok: false, why: `daily limit reached (${COACH_MAX_DAY})` }, 429, origin);

      const state = await listStub(env).read();
      const rideRes = await fetchRides(env, date, date);
      const facts = coachFacts(state, rideRes.ok ? rideRes.rides : [], Number(date.slice(8, 10)), nowMins);
      if (!facts) return json({ ok: false, why: 'no plan for that day' }, 404, origin);

      const out = await askModel(env, COACH_SYSTEM, COACH_SCHEMA, 'advice', facts);
      return json({ ...out, facts, rides_ok: rideRes.ok, calls_today: budget.n }, 200, origin);
    }

    /* The read on his training that a tracking site will not give him, because
       a tracking site does not know what he is eating or why. */
    if (path === '/analyze' && request.method === 'GET') {
      const to = url.searchParams.get('to') || '';
      if (!isDate(to)) return json({ ok: false, why: 'expected to=YYYY-MM-DD' }, 400, origin);
      const weeks = Math.min(12, Math.max(2, Number(url.searchParams.get('weeks')) || 6));
      const from = new Date(to + 'T12:00:00Z');
      from.setUTCDate(from.getUTCDate() - weeks * 7);

      const budget = await listStub(env).spend(to);
      if (!budget.ok) return json({ ok: false, why: `daily limit reached (${COACH_MAX_DAY})` }, 429, origin);

      const rideRes = await fetchRides(env, from.toISOString().slice(0, 10), to);
      if (!rideRes.ok) return json({ ok: false, why: rideRes.why }, 200, origin);
      if (!rideRes.rides.length) return json({ ok: false, why: 'no rides in that window' }, 200, origin);

      const state = await listStub(env).read();
      const stats = trainingStats(rideRes.rides, state.plan, to);
      const out = await askModel(env, ANALYST_SYSTEM, ANALYST_SCHEMA, 'analysis', stats);
      return json({ ...out, stats, calls_today: budget.n }, 200, origin);
    }

    /* One day's actual riding, and what it was. Without ?why it is just the
       activity — free, cached, no model involved — so the app can show what he
       did every time he opens a day. The analysis is a separate, paid opt-in. */
    if (path === '/ride' && request.method === 'GET') {
      const date = url.searchParams.get('date') || '';
      if (!isDate(date)) return json({ ok: false, why: 'expected date=YYYY-MM-DD' }, 400, origin);
      const want = url.searchParams.get('why') === '1';

      const dayRes = await fetchRides(env, date, date);
      if (!dayRes.ok) return json({ ok: false, why: dayRes.why }, 200, origin);
      if (!dayRes.rides.length) return json({ ok: true, rides: [], why: 'no ride that day' }, 200, origin);
      if (!want) return json({ ok: true, rides: dayRes.rides }, 200, origin);

      const budget = await listStub(env).spend(date);
      if (!budget.ok) return json({ ok: false, rides: dayRes.rides, why: `daily limit reached (${COACH_MAX_DAY})` }, 429, origin);

      /* Six weeks of his own riding is the comparison set. */
      const from = new Date(date + 'T12:00:00Z');
      from.setUTCDate(from.getUTCDate() - 42);
      const hist = await fetchRides(env, from.toISOString().slice(0, 10), date);
      const state = await listStub(env).read();
      const dayNum = Number(date.slice(8, 10));
      const day = ((state.plan || {}).days || []).find((d) => d.d === dayNum);
      const train = ((state.plan || {}).training || []).find((t) => t.d === dayNum);

      /* Longest ride of the day is the one worth reading; the 5-minute
         commutes either side of it are not the story. */
      const main = dayRes.rides.slice().sort((a, b) => b.secs - a.secs)[0];
      const ctx = rideContext(
        main, hist.ok ? hist.rides : dayRes.rides,
        day ? { ...day, h: (train && train.h) || day.h } : null,
        (day && day.meals) || [], state.log || {}, date
      );
      if (train && train.bk) ctx.planned_carb_grams_on_the_bike = train.bk.cb || 0;
      if (dayRes.rides.length > 1) ctx.other_rides_that_day = dayRes.rides.filter((r) => r !== main).length;

      const out = await askModel(env, RIDE_SYSTEM, ANALYST_SCHEMA, 'ride_read', ctx);
      return json({ ...out, rides: dayRes.rides, context: ctx, calls_today: budget.n }, 200, origin);
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
