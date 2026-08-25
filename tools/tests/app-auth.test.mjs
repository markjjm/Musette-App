/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* Musette requires account authentication via session tokens:
   A session token identifies who is holding the phone and can be revoked.
   Unauthenticated visitors send no credentials and are required to sign in. */
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
function world(token) {
  const LS = { store: {}, get(k) { return this.store[k] ?? null; }, set(k, v) { this.store[k] = v; } };
  const scope = { authToken: token, LS };
  const fn = new Function('scope', `
    let { authToken, LS } = scope;
    ${src}
    return { headers: () => authHeaders(), out: () => { signedOutHere(); scope.authToken = authToken; } };
  `);
  return { api: fn(scope), scope };
}

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. A token presents Bearer authorization');
const loggedIn = world('tok-abc');
ok(loggedIn.api.headers().Authorization === 'Bearer tok-abc', 'signed in user presents the bearer token');
ok(loggedIn.api.headers()['X-List-Key'] === undefined, 'and does NOT send any legacy access code');

console.log('\n2. Unauthenticated user sends no credentials');
const signedOut = world(null);
ok(Object.keys(signedOut.api.headers()).length === 0, 'no credentials means no auth headers at all');

console.log('\n3. Signing out clears the token');
const session = world('tok-abc');
session.api.out();
ok(Object.keys(session.api.headers()).length === 0, 'after sign out, no auth headers are sent');

console.log('\n4. The token is taken out of the address bar');
ok(/history\.replaceState\(null, '', location\.pathname/.test(html),
  'the fragment is stripped from the URL as soon as it is read');
ok(/LS\.set\('v2\.token'/.test(html), 'and stored, so a reload does not need the link again');

console.log('\n5. The 401 path drops the token and prompts for sign in');
const on401 = html.slice(html.indexOf('if (r.status === 401)'), html.indexOf('if (r.status === 401)') + 400);
ok(/signedOutHere\(\)/.test(on401), 'a 401 clears the token');
ok(/openSettings\(\)/.test(on401), 'and opens settings to sign in');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);

