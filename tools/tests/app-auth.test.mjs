/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* The app predates accounts: it authenticated with a four-digit code shared by
   every phone in the kitchen. That still has to work - two people in a shop are
   not going to sign in - while a session token, when there is one, has to win,
   because it says WHO is holding the phone and it can be revoked.

   The failure to avoid is specific: a revoked token must not lock somebody out
   of their own shopping list. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
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

const src = `${grabFn('function authHeaders() {')}\n${grabFn('function signedOutHere() {')}`;
function world(token, key) {
  const LS = { store: {}, get(k) { return this.store[k] ?? null; }, set(k, v) { this.store[k] = v; } };
  const scope = { authToken: token, cfg: { key }, LS };
  const fn = new Function('scope', `
    let { authToken, cfg, LS } = scope;
    ${src}
    return { headers: () => authHeaders(), out: () => { signedOutHere(); scope.authToken = authToken; } };
  `);
  return { api: fn(scope), scope };
}

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. A token wins, because it identifies a person and can be revoked');
const both = world('tok-abc', '4321');
ok(both.api.headers().Authorization === 'Bearer tok-abc', 'with both, it presents the token');
ok(both.api.headers()['X-List-Key'] === undefined, 'and does NOT also send the household code');

console.log('\n2. The household code still works on its own');
const codeOnly = world(null, '4321');
ok(codeOnly.api.headers()['X-List-Key'] === '4321', 'no token, so the code goes instead');
ok(codeOnly.api.headers().Authorization === undefined, 'and no bearer header is invented');

console.log('\n3. A phone with neither sends nothing, rather than a header of undefined');
const nothing = world(null, '');
ok(Object.keys(nothing.api.headers()).length === 0, 'no credentials means no auth headers at all');

console.log('\n4. Losing the token falls back to the code, it does not lock the door');
/* The whole point: somebody signs out on the website, and the phone in the
   kitchen keeps working because it still knows the household code. */
const revoked = world('tok-abc', '4321');
revoked.api.out();
ok(revoked.api.headers()['X-List-Key'] === '4321', 'after the token is dropped, the code takes over');

console.log('\n5. The token is taken out of the address bar');
/* It arrives in the fragment, which never reaches the server; leaving it on
   screen is how a credential ends up pasted into a chat. */
ok(/history\.replaceState\(null, '', location\.pathname/.test(html),
  'the fragment is stripped from the URL as soon as it is read');
ok(/LS\.set\('v2\.token'/.test(html), 'and stored, so a reload does not need the link again');

console.log('\n6. The 401 path drops the token before deciding anything else');
const on401 = html.slice(html.indexOf('if (r.status === 401)'), html.indexOf('if (r.status === 401)') + 700);
ok(/signedOutHere\(\)/.test(on401), 'a 401 clears the token');
ok(on401.indexOf('signedOutHere()') < on401.indexOf('needCode = true'),
  'and does that BEFORE falling through to "ask for a code"');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
