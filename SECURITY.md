# Security notes

Threat model, honestly stated: a two-person family grocery list. There is no PII
beyond meal choices, no payments, no accounts. The list is intentionally open
(see below), so the realistic risks are (a) a stranger scribbling on the list or
trying to run up storage, and (b) a scripting bug turning a synced item name into
stored XSS across both phones. Everything here is aimed at those two.

## Architecture

| Piece | What it is |
|---|---|
| `web/public/index.html` | The whole front end. One file, inline `<script>`/`<style>`, no third-party code. Data in `localStorage`. |
| `worker/worker.js` | Sync API at `shopping-list-sync.markpjacobs1.workers.dev`. |
| Durable Object `ListDO` | Owns `{rev, updated, plan, extras, ticks, pantry}`. One object, one request at a time, so read-modify-write is atomic. |
| KV `LIST` | Cold backup of the pre-migration blob. Nothing writes to it. |

**The list is behind a 4-digit access code**, entered once per phone and sent
as `X-List-Key`. Be clear-eyed about what that is worth: 10,000 combinations is
not a lot. What makes it defensible is that guessing is throttled to **10 wrong
attempts per minute per IP**, so a single source needs on the order of 17 hours
to exhaust the space, and a distributed attacker still has to want a grocery
list badly. It stops casual and scripted guessing; it is not a password.

Auth **fails closed**: with no `LIST_KEY` set, the Worker returns 503 rather
than serving the list. An earlier version inferred "open" from a missing secret,
and that was observed opening for real — during secret propagation a request
landed on a colo that had not received the value yet and was let straight
through. Running open now requires an explicit `OPEN_LIST = "yes"` var.

What else is enforced:

- `PUT /plan` and `PUT /undo` require `X-Admin-Key`. Replacing the whole meal
  plan (which also clears every check-off) is the one destructive operation,
  and it only ever runs from a laptop, so a key there costs nothing.
- The 256 KB body cap and write schema validation.
- **The failed-attempt throttle is counted in the Durable Object**, not by the
  platform rate limiter. The `[[ratelimits]]` binding deploys cleanly and is
  reported correctly by wrangler, but did not limit anything under test: 90
  requests in a burst, and separately 20 wrong codes in a row, all returned
  without a single 429. The DO already serialises every request, so it counts
  reliably and the behaviour is testable. Verified: attempts 1-10 return 401,
  11+ return 429, and a correct code still succeeds throughout.
- CORS stays pinned to the app's own origin, so a hostile page cannot drive
  writes from a family member's browser.

Changing the code is one command plus re-entering it on each phone:

```sh
printf '1234' | npx wrangler secret put LIST_KEY --config worker/wrangler.toml
```

Because writes are unauthenticated, the Durable Object keeps the previous good
state and `PUT /undo` (admin key) rolls back one step.

## Ride data (intervals.icu)

`GET /rides` returns what was actually ridden, so it can sit next to what was
planned. It is a **server-side proxy**: `INTERVALS_KEY` is a Worker secret, the
page never receives it, and the page could not call intervals.icu directly in
any case — `connect-src` names only this Worker.

Why intervals.icu and not the obvious two: Garmin's Connect Developer Program is
enterprise-only and has paused new access; Strava now requires a paid
subscription to create an app, and its API policy §5.3 forbids passing ride data
to an AI, which is exactly what the next feature does. intervals.icu issues a
personal API key from a settings page and imports from Garmin, Strava, Zwift and
Wahoo, so the data still arrives from whatever recorded the ride.

**Prefer syncing intervals.icu from Garmin or the head unit rather than from
Strava.** It keeps Strava out of the data path entirely, so §5.3 has no purchase
on data this app then hands to a model. That is a routing decision, not a
technical one, and it is the whole reason to care which upstream is connected.

Failure is always soft. A 401, a 429, a timeout and a DNS failure all collapse to
`{ok:false}` and the app carries on showing the meal plan. **A grocery list must
not stop working because a fitness site is having a bad day.** Responses are
edge-cached for ten minutes so that two phones polling `/rev` every four seconds
cannot turn into traffic against someone else's API.

Rotate the key from intervals.icu → Settings → Developer Settings, then:

```sh
npx wrangler secret put INTERVALS_KEY --config worker/wrangler.toml
```

**There are zero third-party runtime dependencies.** Nothing from npm reaches a
browser or the Worker. That removes the entire dependency-CVE class, and it is
why the dependency automation here is deliberately small.

The one supply chain that does exist is **build-time**: `wrangler` and its ~90
transitive packages, which run on a CI machine holding a Cloudflare deploy token.
A compromised package there could exfiltrate that token or tamper with what gets
deployed — and Dependabot auto-merges wrangler's patch/minor updates unattended.
That is the gap [Socket.dev](https://socket.dev) covers (`socket.yml`): it reviews
each dependency PR for malware, install scripts, obfuscated code and typosquats.
For it to actually gate anything, **"Socket Security: Pull Request Alerts" must be
a required status check** — otherwise auto-merge merges straight past its findings.

## Controls in place

Front end:
- **Strict CSP**, hash-based, no `unsafe-inline`: `default-src 'none'`, script and
  style pinned to sha256 hashes, `img-src data:`, `connect-src` pinned to the sync
  Worker, `base-uri`/`form-action`/`frame-ancestors` all `'none'`.
  Generated by `tools/build-csp.mjs` — see the staleness warning below.
- `nosniff`, `no-referrer`, `X-Frame-Options: DENY`, COOP/CORP `same-origin`,
  a deny-most `Permissions-Policy`, and HSTS.
- All rendered values pass through `esc()` (escapes `& < > " '`). Every HTML
  interpolation is individually reviewed and baselined.

Worker:
- Secrets compared with **double-HMAC** (`safeEqual`), not `!==`, so the
  comparison is timing-independent.
- **Per-IP rate limit before anything else**, which is the front line now that
  `/state` is open, and stops `ADMIN_KEY` being ground down. Fails open if the
  binding is missing, so a limiter outage cannot lock the family out.
- **Writes are serialised** through the Durable Object, so two phones syncing in
  the same second cannot lose each other's changes. The previous KV design lost
  60-85% of concurrent writes, silently.
- **256 KB body cap** (413), rejected on both `Content-Length` and actual length.
- **Schema-validated writes**: only `name/qty/cost/store/week/t/deleted` are kept,
  strings capped at 200 chars, `cost` coerced to a finite number, `store`
  constrained, unknown fields dropped. Caps writes at 5000 entries per map.
- **CORS pinned** to `shopping-list-app-9an.pages.dev` and its Pages previews,
  with `Vary: Origin`. Not the primary control — auth is by header, not cookie —
  but it stops a hostile page from reading responses.

## Known and accepted

- **A 4-digit code is weak in absolute terms.** Chosen deliberately: it is a
  grocery list, the code is typed on a phone, and the throttle plus `PUT /undo`
  bound the damage. Move to a long random value any time — same command, then
  re-enter on both phones.
- **No per-device identity.** There is no record of which phone changed what
  beyond the `rev` counter. Fine at this scale.
- **`plan` is rendered from server data.** Writing it requires `ADMIN_KEY`. Costs
  are rendered via `.toFixed()`, so a malformed plan breaks rendering rather than
  executing anything — availability, not XSS.
- **`/health` is unauthenticated.** It returns `{"ok":true}` and nothing else.
- **This repository is public, deliberately.** Consequences, accepted:
  - *No credentials are in it.* `LIST_KEY`/`ADMIN_KEY` are Cloudflare secrets and
    the deploy token is a GitHub secret; `.dev.vars` is gitignored and has never
    been committed. Verified across full history.
  - *The design is disclosed*, including that `/state` is unauthenticated. That
    is fine — obscurity was never the control, and publishing the URL only makes
    explicit what a public repo already implies. The controls that remain are the
    rate limiter, the body cap, write validation, pinned CORS and the CSP.
  - *The bundled August plan is world-readable*: 344 grocery line items, 31 named
    dinners, ~$586 of monthly spend, the stores and region, and ride durations.
    No credential value, but it is a real lifestyle profile. Accepted in exchange
    for free CodeQL code scanning. If that ever stops being an acceptable trade,
    go private and re-read the CodeQL warning in `.github/workflows/security.yml`.
  - The Cloudflare account and KV namespace IDs are visible. These are
    identifiers, not credentials — they appear in dashboard URLs and cannot be
    used without a token.

## The one way to break production

`_headers` carries a **sha256 of the inline script**. Edit `index.html` without
regenerating it and the browser refuses to run the app — a white screen, not a
warning. Guards, in order:

1. `.githooks/pre-commit` regenerates `_headers` automatically on commit.
2. `tools/scan.mjs` fails if it is stale.
3. `deploy.yml` re-checks after deploying that the *served* CSP contains the
   hashes from the repo.

If you ever hand-deploy, run `npm run build` first.

## Rotating secrets

```sh
npx wrangler secret put ADMIN_KEY --config worker/wrangler.toml   # plan + undo
npx wrangler secret put LIST_KEY  --config worker/wrangler.toml   # closes the list
```

Use a long random value: `openssl rand -base64 24`. Setting `LIST_KEY` closes the
list immediately with no code change; then enter it once per phone under the gear
icon. Deleting the secret reopens it.

## Recommended, not yet done

- **Delete the stray `shopping-list-app` Worker.** A duplicate of the sync code
  was deployed under that name and is bound to the same `LIST` KV namespace. It
  has no `LIST_KEY`, so it currently 500s and cannot read or write list data —
  but it is a second door onto the same store and should not exist:
  `npx wrangler delete --name shopping-list-app`
  (This is separate from the *Pages project* of the same name, which is the real
  front end. Do not delete that.)
- **A WAF rate-limiting rule** in the Cloudflare dashboard, in front of the
  Worker's own limiter, if you ever see abuse.
