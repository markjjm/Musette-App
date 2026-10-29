/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Deleting an account, or signing it out everywhere, must target WHO ASKED -
   resolved by the authenticated uid, never by display name.

   The bug this pins: names are not unique. A passkey account takes a
   client-chosen name with no uniqueness check (registerFinish defaults it to
   'Rider'), and removeAccount/revokeSessions used to resolve a name by scanning
   every account and keeping the LAST match. So two phones both named 'Dad', or
   a passkey deliberately named after someone's email login handle, meant
   /me/delete (which passed session.name) deleted - and signout-all logged out -
   the WRONG person, including another user's account. Separately, removeAccount
   on a name that matched NOTHING still returned {ok:true,"removed"}, so an
   operator offboarding by a typo'd name was told "done" while the real account
   stayed live.

   Both are fixed here, and this test fails if either returns: delete/revoke go
   by uid, and the name path resolves to exactly one account or refuses (a miss
   is ok:false, an ambiguous name is ok:false with the candidates listed). */

import { loadWorker } from './load-worker.mjs';
const { ListDO } = await loadWorker(['ListDO']);

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

/* A Durable Object storage over a Map - enough for the account methods:
   get/put/delete and list({prefix}) returning a Map (iterable as [k,v] and with
   .values()), which is exactly what ListDO calls. */
function makeDO(seed = {}) {
  const store = new Map(Object.entries(JSON.parse(JSON.stringify(seed))));
  const ctx = {
    storage: {
      get: async (k) => store.get(k),
      put: async (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); },
      delete: async (k) => { store.delete(k); },
      list: async ({ prefix } = {}) => {
        const out = new Map();
        for (const [k, v] of store) if (!prefix || k.startsWith(prefix)) out.set(k, v);
        return out;
      },
    },
    blockConcurrencyWhile: async (fn) => await fn(),
  };
  return { doInst: new ListDO(ctx, {}), store };
}

/* Two passkey accounts that happen to share the display name 'dad': no email,
   no login handle - exactly what registerFinish writes. */
function twoDads() {
  return makeDO({
    'auth:acct:uidA': { uid: 'uidA', name: 'dad', cred: { id: 'credA' } },
    'auth:acct:uidB': { uid: 'uidB', name: 'dad', cred: { id: 'credB' } },
    'auth:cred:credA': 'uidA',
    'auth:cred:credB': 'uidB',
    'auth:sess:hashA': { uid: 'uidA' },
    'auth:sess:hashB': { uid: 'uidB' },
  });
}

console.log('\n1. Deleting by uid erases the caller, and ONLY the caller');
{
  const { doInst, store } = twoDads();
  const out = await doInst.removeAccountByUid('uidA');
  ok(out.ok === true && out.uid === 'uidA', 'removeAccountByUid reports ok for the right uid');
  ok(!store.has('auth:acct:uidA'), "A's account is gone");
  ok(store.has('auth:acct:uidB'), "B's identically-named account is untouched");
  ok(!store.has('auth:sess:hashA') && store.has('auth:sess:hashB'), "A's session cleared, B's kept");
  ok(!store.has('auth:cred:credA') && store.has('auth:cred:credB'), "A's passkey removed, B's kept");
}

console.log('\n2. A name that two accounts share is refused, not guessed');
{
  const { doInst, store } = twoDads();
  const out = await doInst.removeAccount('dad');
  ok(out.ok === false, 'removeAccount("dad") refuses rather than deleting a coin-flip');
  ok(Array.isArray(out.ambiguous) && out.ambiguous.length === 2, 'and reports both candidates as ambiguous');
  ok(store.has('auth:acct:uidA') && store.has('auth:acct:uidB'), 'neither account was touched');
}

console.log('\n3. A passkey name cannot shadow and delete another account');
{
  /* Bob owns a password/email account with a real login handle. Mallory's
     passkey account carries the display name "bob@x.com" to shadow it. */
  const { doInst, store } = makeDO({
    'auth:user:bob@x.com': 'uidBob',
    'auth:acct:uidBob': { uid: 'uidBob', name: 'bob', email: 'bob@x.com' },
    'auth:acct:uidMal': { uid: 'uidMal', name: 'bob@x.com', cred: { id: 'credMal' } },
    'auth:sess:hashBob': { uid: 'uidBob' },
    'auth:sess:hashMal': { uid: 'uidMal' },
  });
  /* An operator removing "bob@x.com" by name refuses: it resolves to two. */
  const byName = await doInst.removeAccount('bob@x.com');
  ok(byName.ok === false && byName.ambiguous, 'removing the shadowed name refuses as ambiguous');
  ok(store.has('auth:acct:uidBob') && store.has('auth:acct:uidMal'), 'so nobody is deleted by the ambiguous name');
  /* Mallory deleting her OWN account (by her session uid, as /me/delete does)
     cannot reach Bob even though her name shadows his handle. */
  const out = await doInst.removeAccountByUid('uidMal');
  ok(out.ok === true && !store.has('auth:acct:uidMal'), 'Mallory can delete her own account');
  ok(store.has('auth:acct:uidBob'), "Bob's account survives");
  ok(store.get('auth:user:bob@x.com') === 'uidBob', "Bob's login handle still points at Bob");
  ok(store.has('auth:sess:hashBob'), 'Bob is still signed in');
}

console.log('\n4. A removal that matched nothing reports failure, not a false success');
{
  const { doInst } = twoDads();
  const out = await doInst.removeAccount('nobody');
  ok(out.ok === false, 'removeAccount("nobody") is ok:false, not a phantom "removed"');
  ok(/no account/.test(out.why || ''), 'and says why, so an operator sees the miss');
  const byUid = await doInst.removeAccountByUid('ghost');
  ok(byUid.ok === false, 'removeAccountByUid on an unknown id is ok:false too');
}

console.log('\n5. Every login handle for an account is removed - no orphan left behind');
{
  /* An account reachable by two handles: its email, and a later password handle
     (addPassword) that matches neither name nor email. */
  const { doInst, store } = makeDO({
    'auth:user:bob@x.com': 'uidBob',
    'auth:user:bobby': 'uidBob',
    'auth:acct:uidBob': { uid: 'uidBob', name: 'bob', email: 'bob@x.com' },
  });
  const out = await doInst.removeAccountByUid('uidBob');
  ok(out.ok === true, 'the account is removed');
  ok(!store.has('auth:user:bob@x.com'), 'the email handle is gone');
  ok(!store.has('auth:user:bobby'), 'the extra password handle is gone too - no dangling pointer');
  ok(!store.has('auth:acct:uidBob'), 'and the account record is gone');
}

console.log('\n6. Sign-out-everywhere also targets by uid, and refuses an ambiguous name');
{
  const { doInst, store } = twoDads();
  const byUid = await doInst.revokeSessionsByUid('uidA');
  ok(byUid.ok === true && byUid.signed_out === 1, "A's one session is revoked");
  ok(!store.has('auth:sess:hashA') && store.has('auth:sess:hashB'), "B's session is left alone");
  const byName = await doInst.revokeSessions('dad');
  ok(byName.ok === false && byName.ambiguous, 'revokeSessions("dad") refuses rather than signing out a guess');
}

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
