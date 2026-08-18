/* Part of the repo's proof that its controls exist. Run with `npm test`. */
/* The signature check is the whole of the account system: everything else is
   bookkeeping around "did this person hold the private key". It fails CLOSED -
   a wrong conversion refuses every login - so it has to be exercised against a
   real key rather than reasoned about. */
/* Node 22 already exposes a read-only globalThis.crypto with the WebCrypto API
   the Worker uses, so nothing needs installing - just asserted, so this test
   fails loudly rather than silently skipping the only check that matters. */
if (!globalThis.crypto || !globalThis.crypto.subtle) throw new Error('no WebCrypto in this node');
const { b64u, derToRaw, checkClientData } = await (async () => {
  const { loadWorker } = await import('./load-worker.mjs');
  return loadWorker(['b64u', 'derToRaw', 'checkClientData']);
})();

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

console.log('\n1. base64url survives a round trip');
const bytes = new Uint8Array([0, 1, 250, 255, 128, 64, 62, 63]);
ok(b64u.enc(bytes).indexOf('+') < 0 && b64u.enc(bytes).indexOf('/') < 0 && b64u.enc(bytes).indexOf('=') < 0,
  `no +, / or = in the alphabet (${b64u.enc(bytes)})`);
ok([...b64u.dec(b64u.enc(bytes))].join(',') === [...bytes].join(','), 'and the bytes come back identical');

console.log('\n2. A real P-256 signature verifies through derToRaw');
/* If the DER to P-1363 conversion is wrong, this fails - which is exactly how
   it would fail in production: silently, for every account. */
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const msg = new TextEncoder().encode('authenticatorData||clientDataHash');
let rawOk = 0, derOk = 0;
for (let i = 0; i < 25; i++) {
  /* WebCrypto signs in P-1363 already; re-wrap it as DER so the test exercises
     the same shape a real authenticator sends. */
  const p1363 = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, msg));
  const toDerInt = (b) => {
    let s = 0; while (s < 31 && b[s] === 0) s++;
    let v = b.subarray(s);
    if (v[0] & 0x80) { const t = new Uint8Array(v.length + 1); t.set(v, 1); v = t; }
    return [0x02, v.length, ...v];
  };
  const rs = [...toDerInt(p1363.subarray(0, 32)), ...toDerInt(p1363.subarray(32))];
  const der = new Uint8Array([0x30, rs.length, ...rs]);
  const back = derToRaw(der);
  if (back && [...back].join(',') === [...p1363].join(',')) rawOk++;
  if (back && await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, back, msg)) derOk++;
}
ok(rawOk === 25, `25 of 25 signatures convert back byte-identically (${rawOk})`);
ok(derOk === 25, `and all 25 verify against the public key (${derOk})`);

console.log('\n3. Malformed signatures are refused, not coerced');
ok(derToRaw(new Uint8Array([0x31, 4, 2, 1, 1, 2, 1, 1])) === null, 'a non-SEQUENCE is refused');
ok(derToRaw(new Uint8Array([0x30, 4, 0x03, 1, 1, 2, 1, 1])) === null, 'a non-INTEGER component is refused');

console.log('\n4. clientData is checked on all three axes');
const cd = (o) => new TextEncoder().encode(JSON.stringify(o));
const ORIGINS = ['https://musetteapp.com'];
ok(checkClientData(cd({ type: 'webauthn.get', challenge: 'abc', origin: 'https://musetteapp.com' }), 'webauthn.get', 'abc', ORIGINS) === null,
  'a good assertion passes');
ok(/expected webauthn.get/.test(checkClientData(cd({ type: 'webauthn.create', challenge: 'abc', origin: 'https://musetteapp.com' }), 'webauthn.get', 'abc', ORIGINS) || ''),
  'a registration blob replayed at login is refused');
ok(/challenge/.test(checkClientData(cd({ type: 'webauthn.get', challenge: 'OTHER', origin: 'https://musetteapp.com' }), 'webauthn.get', 'abc', ORIGINS) || ''),
  'a replayed challenge is refused');
ok(/origin/.test(checkClientData(cd({ type: 'webauthn.get', challenge: 'abc', origin: 'https://evil.example' }), 'webauthn.get', 'abc', ORIGINS) || ''),
  'a signature made on another origin is refused');
ok(checkClientData(new TextEncoder().encode('not json'), 'webauthn.get', 'abc', ORIGINS) !== null, 'and junk is refused');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
