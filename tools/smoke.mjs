#!/usr/bin/env node
/*
 * Boots nothing. Talks to the DEPLOYED Worker and walks the paths a person
 * actually takes, because that is the gap the unit tests cannot see.
 *
 *   node tools/smoke.mjs                 # against the workers.dev hostname
 *   LIST_URL=https://api.musetteapp.com node tools/smoke.mjs
 *
 * This exists because three undeclared identifiers - HOUSEHOLD, authStub,
 * dataStub - passed fourteen green test files and 250 assertions, and then
 * threw 1101 on every auth route in production. The suite exercises pure
 * functions and never constructs a request. Green tests are not a deployment.
 *
 * It creates a throwaway account and removes it again, so running it is cheap
 * and leaves nothing behind.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const devVars = join(root, 'worker/.dev.vars');
function env(name, fallback) {
  if (process.env[name]) return process.env[name];
  if (existsSync(devVars)) {
    const m = new RegExp(`^${name}=(.*)$`, 'm').exec(readFileSync(devVars, 'utf8'));
    /* .dev.vars values may be quoted; sourcing it in a shell strips those and
       reading it here did not, so a four-digit code arrived as six characters
       and every authenticated call quietly 401'd. */
    if (m) return m[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return fallback;
}

const API = env('LIST_URL', 'https://shopping-list-sync.markpjacobs1.workers.dev').replace(/\/+$/, '');
const ADMIN = env('ADMIN_KEY', '');
const LIST_KEY = env('LIST_KEY', '');

let pass = 0, fail = 0;
const ok = (c, m, detail) => {
  if (c) { pass++; console.log(`  \x1b[32mok\x1b[0m   ${m}`); }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${m}${detail ? ' — ' + detail : ''}`); }
};

const enc = (b) => Buffer.from(b).toString('base64url');
const dec = (s) => Buffer.from(s, 'base64url');
async function derive(pw, salt, iters) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return enc(new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: dec(salt), iterations: iters, hash: 'SHA-256' }, k, 256)));
}
async function call(path, { method = 'GET', body, headers } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* an HTML error page is itself the finding */ }
  return { status: r.status, json, text };
}

console.log(`\nsmoke: ${API}\n`);

/* 1. The Worker is up and returning JSON, not a Cloudflare error page. */
const health = await call('/health');
ok(health.status === 200 && health.json && health.json.ok === true,
  'the Worker answers /health with JSON', `${health.status} ${health.text.slice(0, 60)}`);
if (health.status !== 200) {
  console.log('\n  stopping: nothing else can pass if the Worker is down\n');
  process.exit(1);
}

/* 2. Auth routes execute at all. This is the exact check that would have
      caught the undeclared identifiers - they threw before any logic ran. */
const opts = await call('/auth/password/options', { method: 'POST', body: { username: 'smoke@example.com' } });
ok(opts.status === 200 && opts.json && opts.json.salt,
  'auth routes run and hand back a salt', `${opts.status} ${opts.text.slice(0, 80)}`);

/* 3. Data is refused without a credential. */
const bare = await call('/state');
ok(bare.status === 401, 'unauthenticated /state is refused', `got ${bare.status}`);

/* 4. The household code still opens the household. */
if (LIST_KEY) {
  const phone = await call('/state', { headers: { 'X-List-Key': LIST_KEY } });
  ok(phone.status === 200 && phone.json && phone.json.plan,
    'the access code still opens the household plan', `got ${phone.status}`);
} else {
  console.log('  \x1b[33mskip\x1b[0m no LIST_KEY, so the phone path was not checked');
}

/* 5. A whole account, end to end, then removed. */
if (!ADMIN) {
  console.log('  \x1b[33mskip\x1b[0m no ADMIN_KEY, so signup and isolation were not checked\n');
} else {
  const A = { 'X-Admin-Key': ADMIN };
  const inv = await call('/auth/invite', { method: 'POST', body: {}, headers: A });
  ok(inv.status === 200 && inv.json && inv.json.code, 'an invite can be minted');

  const email = `smoke-${Date.now()}@example.com`;
  const o = await call('/auth/password/options', { method: 'POST', body: { username: email } });
  const reg = await call('/auth/password/register', { method: 'POST', body: {
    code: inv.json.code, username: email, salt: o.json.salt,
    verifier: await derive('a smoke test passphrase', o.json.salt, o.json.iterations) } });
  ok(reg.status === 200 && reg.json && reg.json.token, 'an account can be created', reg.text.slice(0, 90));

  if (reg.json && reg.json.token) {
    const H = { Authorization: `Bearer ${reg.json.token}` };
    const meRes = await call('/me', { headers: H });
    ok(meRes.status === 200 && meRes.json.ok, 'a session opens /me', `got ${meRes.status}`);

    const st = await call('/state', { headers: H });
    ok(st.status === 200, 'a session opens /state', `got ${st.status}`);
    /* The isolation property, checked on every deploy rather than once. */
    ok(st.json && st.json.plan === null && Object.keys(st.json.ticks || {}).length === 0,
      'a NEW account sees no plan and no ticks — isolated from the household',
      `plan=${st.json && st.json.plan ? (st.json.plan.block || 'set') : 'null'}, ticks=${Object.keys((st.json || {}).ticks || {}).length}`);

    const icu = await call('/me/intervals', { headers: H });
    ok(icu.status === 200 && icu.json.linked === false, 'intervals.icu reports not linked');

    const prof = await call('/me/profile', { method: 'PUT', headers: H,
      body: { name: 'Smoke', weight_lb: 170, height_in: 70, age: 40, goal: 'hold' } });
    ok(prof.status === 200 && prof.json.profile && prof.json.profile.name === 'Smoke',
      'a profile can be written and comes back');

    const seed = await call('/plan/seed', { method: 'POST', headers: H, body: {
      sport: 'walking', level: 'starting', days: ['Mon', 'Wed', 'Sat'], long_day: 'Sat',
      profile: { name: 'Smoke', weight_lb: 170, height_in: 70, age: 40, goal: 'hold' } } });
    ok(seed.status === 200 && seed.json.ok && seed.json.plan.days.length > 27,
      'a first month can be generated', seed.text.slice(0, 90));
    if (seed.json && seed.json.ok) {
      const bad = seed.json.plan.days.filter((d) => d.meals.reduce((a, m) => a + m.kc, 0) !== d.kc);
      ok(bad.length === 0, 'and every generated day adds up', `${bad.length} do not`);
    }

    const gone = await call('/auth/remove', { method: 'POST', headers: A, body: { username: email } });
    ok(gone.status === 200, 'the throwaway account was removed again');
    const after = await call('/me', { headers: H });
    ok(after.status === 401, 'and its session died with it', `got ${after.status}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
