<!-- Produced by an adversarial research workflow, then reviewed. The research
     verified its own claims against primary sources (the Public Suffix List was
     fetched, not recalled) and found three live bugs in the current single-tenant
     code, two of which are already fixed. Nothing here is built yet. -->

# Musette multi-tenant — decision document

**Status:** decision, not a proposal. Read-only review of `worker/worker.js` (1,446 lines), `worker/wrangler.toml`, `web/public/index.html`.

---

## 1. Recommendation

Build multi-tenancy as **one Durable Object per household, addressed by a 128-bit random id, with authorisation enforced inside the object rather than in the router**, and authenticate with **WebAuthn passkeys and invite links — no email, no passwords, no third-party IdP**. Buy a domain first (~$10/yr) so Pages and the Worker are same-site and the passkey RP ID never has to move. The single biggest thing that changes is not auth: it is that **`plan` stops being one object**. Today `plan.days[].meals[].kc` is one rider's calorie target sitting inside the shopping list. The menu is household-scoped; the macros, the weight, the food log and the training data are person-scoped. Splitting that is the actual engineering work, and it is also the only way two people in one household get correct portions.

---

## 2. Auth

**Mechanism: platform passkeys only, `attestation: "none"`, invite-only signup.** Rejected: email magic links (Cloudflare Email Sending is Workers Paid only; a free-tier ESP is a new runtime dependency, a new secret, and a new processor holding users' email addresses); passwords (WebCrypto's only KDF is PBKDF2, OWASP wants 600k iterations ≈ 150–350 ms CPU, and the free plan gives you **10 ms per invocation** — indefensible at any work factor); OAuth (zero npm, but Google/GitHub becomes a hard runtime dependency that learns every login to a nutrition app).

**Cost against the zero-runtime-dependency rule: zero npm, zero outbound calls to anyone but your own Worker.** ES256 is ECDSA P-256 + SHA-256 — native in WebCrypto. `response.getPublicKey()` returns DER SubjectPublicKeyInfo straight into `importKey('spki', …)` (baseline across all four engines since Oct 2023), so **you never need a CBOR decoder**; `authenticatorData` is a fixed byte layout. Two honest non-code dependencies to write into SECURITY.md: passkey *portability* rests on iCloud Keychain / Google Password Manager, and you are hand-writing security-critical parsing. Also replace `safeEqual()`'s generate-a-key-and-double-HMAC dance with `crypto.subtle.timingSafeEqual` — the current version calls `generateKey` on every auth check against a 10 ms budget.

**Endpoints**

```
POST /auth/register/options    invite code (fragment) -> challenge, rp, user handle
POST /auth/register/verify     attestation -> member created, tokens issued
POST /auth/login/options       -> challenge (discoverable credential, no username)
POST /auth/login/verify        assertion -> tokens issued
POST /auth/refresh             cookie + DPoP-lite proof -> new access token
POST /auth/logout              revokes the family
POST /household/invites        member-only, single-use, 24h
```

**The cross-domain cookie problem.** `pages.dev` and `workers.dev` are both on the Public Suffix List. They are not merely different origins, they are different *sites* — every cookie the Worker sets is third-party, needs `SameSite=None; Secure; Partitioned`, and still gets partitioned by Firefox and expiry-capped and evicted by Safari ITP. That is silent random logout as a design feature. **Resolution: buy the domain.** `app.musette.tld` (Pages) + `api.musette.tld` (Worker) are same-site. Do this *before anyone enrols a passkey* — the RP ID is bound to the domain and migrating later invalidates every credential.

**Token shape.**

- Access: bearer, `Authorization: Bearer m1.<hid>.<secret>` — 22 chars base64url household routing + 43 chars (256-bit) member secret. **JavaScript memory only, never `localStorage`.** 15 min TTL. Data endpoints stay non-credentialed (`Access-Control-Allow-Credentials` off), which makes CSRF on them structurally impossible.
- Refresh: cookie on `/auth/refresh` only — `__Host-mr=…; HttpOnly; Secure; SameSite=Lax; Path=/auth/refresh` with **no `Domain`**. JavaScript cannot read it. Single-use rotating, family-based reuse detection (a replayed token revokes the whole family — that is your theft alarm), 30-day idle / 180-day absolute. Bind it to a **non-extractable** P-256 key in IndexedDB and require a signature on refresh: XSS can use the key on-page but cannot exfiltrate it.
- Revocation lag = access TTL = 15 minutes. Accept and document it.

**Fix now, before credentials exist:** `allowedOrigin()` (worker.js:18–32) admits `*.shopping-list-app-9an.pages.dev` and `localhost`. Any branch can create a preview deploy. Under credentials that reads authenticated health data. Delete the suffix match and the localhost clause from the credentialed path.

**`/admin`: put Cloudflare Access in front of it and delete `X-ADMIN-KEY`.** Free to 50 seats, validate `Cf-Access-Jwt-Assertion` (RS256, WebCrypto-verifiable) against your team JWKS. A shared static secret guarding destructive operations on strangers' health data is the cheapest control upgrade in this migration. Access is *not* usable for app login — no self-serve signup, 50-seat cliff.

---

## 3. Isolation

**Topology.** `HouseholdDO` at `idFromName(hid)` where `hid` is 128 bits from `crypto.getRandomValues`, base64url. Chosen over `newUniqueId()` because it is idempotent: token → stub is a pure function, no registry on the hot path, no consistency window. Plus one `RegistryDO` (`idFromName('registry')`) touched only at signup, invite redemption, and deletion — **not KV** (60 s propagation on invites and revocations; this project already lost writes to KV's lack of CAS) and **not D1** (a missing `WHERE household_id = ?` is a cross-tenant read; a DO gives physical separation).

**Membership lives inside the household DO** (`h:meta.members`, `s:<sha256(tok)>` session rows). Routing is untrusted; authorisation happens in the tenant.

```js
// worker.js — the ONLY place env.LIST_DO is referenced
const TOK = /^m1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;

async function session(request, env) {
  const m = TOK.exec((request.headers.get('Authorization') || '').replace(/^Bearer /, ''));
  if (!m) return null;
  const stub = env.LIST_DO.get(env.LIST_DO.idFromName(m[1])); // routing hint only
  return await stub.open(m[2]);                                // authorisation; throws
}

// HouseholdDO
async open(secret) {
  const row = await this.ctx.storage.get('s:' + await sha256b64(secret));
  if (!row || row.exp < Date.now()) throw new Error('unauthenticated');
  return new Session(this, row.uid, row.role);  // extends RpcTarget
}
```

`open()` returns an **`RpcTarget`** — a live capability. Routes hold `sess`, never a stub, so there is no way to touch data without having authenticated. Point the `hid` prefix at someone else's household and the secret does not exist there. An unprovisioned `hid` has no members, so nothing is written or billed.

**If a route forgets the check:** today (`listStub(env)` at worker.js:935, re-derived at nine call sites) it is an unauthenticated full read of profile, weight, age and food log — Art. 9 breach, 72-hour clock. Under the capability shape it is `sess === undefined` → TypeError → 500. **Fail loud.** Make it testable: assert in `tools/scan.mjs` that `LIST_DO` appears **exactly once** in `worker.js`, next to the existing CSP staleness check.

**Three present bugs that become breaches on day one:** `/rides` caches in `caches.default` under `https://rides.local/${oldest}/${newest}` (worker.js:1257) — no tenant in the key, so B gets A's rides. `INTERVALS_KEY` with `athlete='0'` (worker.js:1164–1169) returns *the owner's* rides to every tenant. `spend()` and `noteFailure()` (worker.js:858, 876) live on the single `household` object — a global DoS and a global write bottleneck.

---

## 4. Data model

```
h:meta      {hid, created, members:[uid], schema}
h:menu      SHARED  dinners, ingredients, cost, store, week   (was plan.days[].meals)
h:extras    SHARED  (+ by: uid)
h:ticks     SHARED  (+ by: uid)
h:pantry    SHARED  one physical cupboard
h:dishes    SHARED  user-built recipes
h:prev      one-deep undo, SHARED scope only
h:rev       {h: n, u: {uid: n}}

u:<uid>:profile  PERSONAL  weight_lb, height_in, age, goal, rate_lb_wk, ftp, hours_wk
u:<uid>:targets  PERSONAL  per-day kcal / carb / portion multiplier
u:<uid>:log      PERSONAL  what was eaten
u:<uid>:icu      PERSONAL SECRET  envelope-encrypted intervals.icu token
u:<uid>:spend    PERSONAL  {day, cents}
s:<sha256(tok)>  {uid, role, created, last, ua, exp}
i:<code>         {role, exp, uses}
```

`Session.readShared()` returns `h:*`; `Session.readSelf()` returns `u:<own uid>:*`. **There is no method that returns `u:*` for a uid other than the session's own.** The comment at the old `read()` — "returns state wholesale, so nothing private may live there" — becomes a structural property instead of a warning. Prefix layout also gives clean per-user erasure.

---

## 5. Cost and abuse

Verified: `max_output_tokens: 4000` **is** already set (worker.js:547), and `spend()` correctly takes the day from the server clock. Good. The remaining hole is **input**: `setPlan` stores the plan verbatim (worker.js:910), unvalidated beyond `MAX_BODY` 256 KB, and it flows straight into the prompt. Multi-tenancy promotes `plan` from trusted to hostile — a cost amplifier *and* a prompt-injection channel aimed at the "no medical advice, nothing about disordered eating" guardrail.

| Layer | Control | Number |
|---|---|---|
| **L0** | Validate plan like ticks/pantry already are: days ≤ 31, meals/day ≤ 10, label ≤ 80 chars, kcal int 0–5000; hard-cap `JSON.stringify(facts)` at 8 KB | worst case $0.096 → **$0.0035/call** |
| **L1** | Per-household budget in **cents, not calls** — 25¢/household/day | ≈70 clamped calls/day |
| **L2** | Invite-only signup. **No Turnstile** — it loads a remote script and breaks the hash-pinned `default-src 'none'` CSP, i.e. exactly the documented dependency rule | identity costs an invite |
| **L3** | `BudgetDO` (`idFromName('global')`), decrement before every model call, hard stop **$2/day, $40/month**. Must be a DO — `[[ratelimits]]` is per-location and eventually consistent; wrangler.toml already records that it limited nothing in testing | bounds total liability |
| **L4** | Dedicated OpenAI **project** with a hard spend limit ($25/mo) + alert ($5). 429s land in the existing `rate limited` path | backstop, not instantaneous |

**What an attacker can spend before something stops them:** with L0–L3, **$2 in a day** and then the breaker trips. With L1 alone and scripted signups, 1,000 households × 25¢ = **$250/day**. With no caps at all the binding constraint is your OpenAI tier, not your code: saturating Tier 1's 500k TPM is **$18–$60/hour, $432–$1,440/day**. The Workers 100k req/day cap never binds first.

---

## 6. intervals.icu

**Per-user OAuth. Apply this week — registration is manual, by email to `david@intervals.icu`, and takes days.** Request `ACTIVITY:READ` only. Authorize `https://intervals.icu/oauth/authorize`, token `https://intervals.icu/api/oauth/token`. This is not just an attribution fix: the personal API key is **5,000 requests/day shared by every tenant**, so roughly 50 active households exhaust it and all tenants fail at once; OAuth gives each user 100/day. The personal key also has *no scopes* and grants write access to the owner's account.

Design around three facts: no refresh tokens (access tokens expire in hours — fetch on user action, which the code already does; handle 401 by re-authorizing), one token per user (a second device invalidates the first — store per household, expect re-auth to be routine), and cache per household with the tenant in the cache key.

**Fallback if registration is refused:** each tenant pastes their own key, AES-GCM encrypted at rest under a Worker secret, never returned by any read method. Worse — unscoped, long-lived, write-capable — but per-tenant. **Either way the owner's key cannot ship.** Until per-tenant credentials exist, `/rides` returns "not linked" for every non-owner household.

---

## 7. Run cost

| | 10 households | 100 | 1,000 |
|---|---|---|---|
| Worker requests/day (poll at 4 s, `POLL_MS`, index.html:1475) | ~10k | **~100k — free tier breaks** | 1M |
| Worker requests/day (poll at 20 s) | ~2k | ~20k | 200k |
| DO requests/day | tracks Workers 1:1 | **breaks simultaneously** | — |
| DO SQLite storage (5 GB account-wide) | trivial | ~120 MB | ~1.2 GB |
| OpenAI at L1 caps | ≤$2.50/day | capped by L3 at **$2/day** | capped at $2/day |
| Cloudflare bill | $0 | $0 with the poll fix | **$5/mo Workers Paid** |

**Change one constant first: `POLL_MS` 4000 → 20000.** It cuts request volume 5× and moves the ceiling from ~55–100 households to ~300–500, for free. Then Workers Paid at $5/mo takes you to ~10,000. **Do not add per-household KV cold backup** — KV free is 1,000 writes/day *account-wide*, which is ~30 households at hourly. Use R2 (10 GB free) or a single daily rollup blob.

Realistic steady state at 100 households: **$5/mo Cloudflare + ~$40/mo OpenAI ceiling + $10/yr domain.**

---

## 8. What you are signing up for

You will hold strangers' bodyweight, age, training load and food logs. That is Art. 9 special-category data: explicit consent at signup logged with a timestamp, a named sub-processor list (OpenAI, intervals.icu, Cloudflare), self-serve export (Art. 20) and self-serve deletion (Art. 17), and a 72-hour breach notification duty — which the no-email design makes genuinely hard, because **you have no way to notify anyone.** Decide that now: either an in-app banner plus a published incident page counts as your notification channel, or you collect a contact address after all. Also confirm OpenAI's retention posture (default 30-day abuse retention) before other people's bodyweight goes through your key. And note the residue you must enumerate to pass your own audit: `h:prev` holds a full copy of deleted shared state, the `caches.default` `/rides` entry, the existing 90-day `prune()` (which **is** a retention policy — write it down as one), and Cloudflare request logs.

The billing exposure is real but bounded: with L3 in place you are risking $40/month of your own money on strangers, and the failure mode is "the coach stops working today", not a five-figure invoice.

**Is it worth it versus staying single-tenant?** If the goal is a handful of households you personally know, **do this** — the work is a weekend of auth plus the `plan` split, the liability is manageable, and invite-only means you choose every tenant. If the goal is open public signup, **it is not worth it**: at that point you are a health-data controller with a support obligation, an unbounded deletion queue, and a bill that scales with other people's habits, for zero revenue. The honest middle path is **invite-only multi-tenancy with a documented ceiling of ~50 households**, and a clean self-host story (`wrangler deploy` + your own secrets) for anyone beyond that — self-hosters are their own controller, which removes the entire Art. 9 exposure. Phase 5 in the auth research (open signup, paid email) is the point at which you should stop and decide whether this is a product or a favour.

---

## 9. Build order

Each step ships on its own; single-tenant keeps working throughout.

1. **Hygiene, no tenancy.** Clamp `setPlan` with an allowlist validator; add the 8 KB facts cap; drop the origin suffix + localhost from `allowedOrigin()`; put the tenant in the `/rides` cache key; `POLL_MS` → 20000; swap `safeEqual` for `crypto.subtle.timingSafeEqual`.
2. **Buy the domain.** `app.` on Pages, `api.` on the Worker, update CSP `connect-src`. Nothing else changes. **This must precede step 5.**
3. **Cloudflare Access on `/admin/*`**, delete `ADMIN_KEY`. Add the `LIST_DO`-appears-once assertion to `tools/scan.mjs` (it passes trivially today; it will hold you honest later).
4. **`BudgetDO` + cents-denominated `spend()`.** Global $2/day breaker live while still single-tenant. Create the dedicated OpenAI project with its hard limit.
5. **Passkeys against the existing single household.** `HouseholdDO` grows `open()`/`Session`; `hid` is still `'household'` internally, but auth is now per-member. Old `X-List-Key` path stays as a fallback behind a flag; delete it once you and your partner are both enrolled.
6. **The `plan` split** — `h:menu` + `u:<uid>:targets`, with a migration on first read. Two people, correct portions, one shared list. Ship this before any stranger sees the app.
7. **`RegistryDO` + invites + random `hid`.** `idFromName('household')` becomes a legacy alias; new households get 128-bit ids. Now genuinely multi-tenant.
8. **intervals.icu OAuth** per user (registration submitted back at step 1); proxy stays disabled for households without their own credential.
9. **Export, deletion, consent checkbox, recovery codes, `h:prev` purge on erase.** No public invite goes out before this step is done.