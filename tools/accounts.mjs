#!/usr/bin/env node
/*
 * Manage who can get in.
 *
 *   node tools/accounts.mjs invite "Dave from the club"   -> a one-use code, 24h
 *   node tools/accounts.mjs list                          -> who has an account
 *
 * Reads LIST_URL and ADMIN_KEY from the environment, or from worker/.dev.vars
 * so neither ever has to be typed into a shell and left in history.
 *
 * There is no UI for this on purpose: minting an invite is the only way into
 * the app, so it is the one action that must never be self-serve. Keeping it in
 * a terminal that already holds the admin key is the smallest surface that does
 * the job.
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
    if (m) return m[1].trim();
  }
  return fallback;
}

const URL_BASE = (env('LIST_URL', 'https://api.musetteapp.com')).replace(/\/+$/, '');
const ADMIN = env('ADMIN_KEY', '');
if (!ADMIN) {
  console.error('No ADMIN_KEY. Put it in worker/.dev.vars or pass ADMIN_KEY=... in the environment.');
  process.exit(1);
}

async function call(path, body) {
  const r = await fetch(URL_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN },
    body: JSON.stringify(body || {}),
  });
  const out = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok || out.error) {
    console.error(`${path} failed: ${out.error || out.why || r.status}`);
    process.exit(1);
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === 'invite') {
  const note = rest.join(' ');
  const out = await call('/auth/invite', { note });
  console.log(`\n  Code:     ${out.code}`);
  console.log(`  Good for: ${out.expires_in_hours} hours, one use`);
  if (note) console.log(`  For:      ${note}`);
  console.log(`\n  Send them this:\n\n    https://musetteapp.com/signin  —  code ${out.code}\n`);
} else if (cmd === 'list') {
  const out = await call('/auth/accounts', {});
  if (!out.accounts.length) {
    console.log('\n  No accounts yet. `node tools/accounts.mjs invite` to make the first code.\n');
  } else {
    console.log(`\n  ${out.accounts.length} account${out.accounts.length > 1 ? 's' : ''}:\n`);
    for (const a of out.accounts) {
      const seen = a.last ? `last seen ${a.last.slice(0, 10)}` : 'never signed in since';
      console.log(`   ${a.name.padEnd(20)} joined ${a.created.slice(0, 10)}   ${seen}`);
    }
    console.log('');
  }
} else if (cmd === 'remove') {
  const who = rest.join(' ').trim();
  if (!who) { console.error('  Who? node tools/accounts.mjs remove <username>'); process.exit(1); }
  const out = await call('/auth/remove', { username: who });
  console.log(`\n  Removed ${out.name} — ${out.removed.join(', ')}\n`);
} else if (cmd === 'signout') {
  const who = rest.join(' ').trim();
  const out = await call('/auth/signout-all', { username: who });
  console.log(`\n  Signed ${who} out of ${out.signed_out} place(s). The account is untouched.\n`);
} else if (cmd === 'invites') {
  const out = await call('/auth/invites', {});
  if (!out.invites.length) { console.log('\n  No invites yet.\n'); }
  else {
    console.log('');
    for (const i of out.invites) {
      const when = i.state === 'open' ? `${i.hours_left}h left` : i.state;
      console.log(`   ${i.code}   ${when.padEnd(10)} ${i.note}`);
    }
    console.log('');
  }
} else {
  console.log(`
  node tools/accounts.mjs invite ["who it is for"]   one-use code, good for 24 hours
  node tools/accounts.mjs list                       who has an account
  node tools/accounts.mjs invites                    codes issued, and their state
  node tools/accounts.mjs signout <username>         sign them out everywhere, keep the account
  node tools/accounts.mjs remove <username>          delete the account and every way back in

  Talking to ${URL_BASE}
`);
}
