<!-- The intervals.icu OAuth application: what to send, what has to exist first,
     and what to do with the reply. Registration is manual and takes days, so this
     is the long pole on per-user activity sync. -->

# intervals.icu OAuth application

**Status:** two blanks left — a logo URL and your intervals.icu id — plus one real blocker,
the privacy policy, which has to be live at the URL this email claims. Approval is a human
reading an email; expect days, not minutes.

---

## Why this and not a device integration

Settled, so it does not get re-litigated:

- **Garmin** — partner-approval only, needs a legal entity, a manual business review and a
  one-time administrative fee. New sign-ups are on hold; the access-request form has been
  withdrawn with no published re-open date.
- **Strava** — needs an active $11.99/mo subscription for Standard-tier API access as of
  June 2026, and the June 2026 policy prohibits using Strava data "in connection with the
  development, training, evaluation, or operation of any AI Application," explicitly
  including "ingestion into a context window or working memory." That is precisely what
  this app does. Not a licensing problem; a prohibition.
- **Wahoo / Polar / Suunto / COROS** — each its own application, approval and integration,
  for one vendor's slice of users.
- **Commercial aggregators** — Terra at $399–499/mo base, Rook at $0.50/user/mo on a
  $300/mo minimum. A $3,600–5,000/yr floor before the first user.

intervals.icu already ingests from Garmin, Wahoo, Polar, Suunto, COROS, Zwift, MyWhoosh,
Rouvy, Hammerhead, Concept2, Amazfit, Huawei, Oura, WHOOP, Strava and Dropbox, and when two
services upload the same ride the direct-device copy wins over the Strava copy. They hold
the partner agreements that are not available to us. One integration, every device, no fee.

---

## Blanks to fill before sending

| Field | Status |
|---|---|
| App name | **Musette** — settled. |
| Website URL | `https://musetteapp.com` — **domain bought 2026-08-17**, needs the public site actually serving there. |
| Privacy policy URL | `https://musetteapp.com/privacy` — **does not exist yet.** |
| `[LOGO URL]` | Square, at least 128×128, publicly reachable. Serve it off Pages once the site is up. |
| Redirect URI | `https://api.musetteapp.com/auth/intervals/callback` — hostname configured in `worker/wrangler.toml`. |
| `[INTERVALS ID]` | Own athlete id from `intervals.icu/settings`. Five-minute job. |

**One hard blocker left: the privacy policy must be live before this can be sent.** That makes
**steps 1–2 of [website-spec.md](website-spec.md) the gate on device sync**, not just on the
sign-in page. Build them first; everything else here is now filled in or trivial.

---

## The email

> **To:** david@intervals.icu
> **Subject:** OAuth application request — Musette
>
> Hi David,
>
> I'd like to register an OAuth application against the intervals.icu API.
>
> **App name:** Musette
> **Description:** A nutrition planner that fuels a training week. It reads a rider's
> completed activities and uses measured work (`icu_joules`), training load and the
> zone-time breakdown to compute CTL/ATL/TSB, then sets that day's calorie and carbohydrate
> targets against it — so an easy Tuesday and a five-hour Saturday are not fed the same way.
> The training data is read-only; nothing is written back to intervals.icu.
> **Website:** https://musetteapp.com
> **Logo:** [LOGO URL] (square, 256×256)
> **Privacy policy:** https://musetteapp.com/privacy
> **Redirect URI:** https://api.musetteapp.com/auth/intervals/callback
> **My intervals.icu id:** [INTERVALS ID]
>
> **Scopes requested: `ACTIVITY:READ` only.** No write scope, no wellness, no calendar —
> bodyweight is entered by the user in our own app rather than read from yours.
>
> Three things you may want to know up front:
>
> 1. **How we call the API.** Fetches happen on user action, never on a timer, and every
>    response is edge-cached per athlete and date range — ten minutes for a finished range,
>    one minute for a range reaching today so a just-synced ride is not missing. We honour
>    `Retry-After` on 429 and read `X-RateLimit-Remaining`. Realistically that lands around
>    20–40 calls per user per day, well inside the 100/user allowance.
>
> 2. **There is an LLM in the product, and I'd rather say so than have you find out.** The
>    numbers above — load, kJ, zone times, CTL/ATL/TSB — are computed in our own code, not
>    by a model. A model is used to explain the resulting plan in plain language and to
>    answer questions about it, so a small, fixed set of derived figures does go into a
>    prompt. No activity streams, no GPS, no bulk export, and no training of any model on
>    intervals.icu data. If any part of that is not acceptable I would rather adjust it now
>    than be surprised later; I'm happy to describe the exact payload.
>
> 3. **Expected scale.** Invite-only to start, tens of users, growing toward a few hundred
>    if it works. I see the per-app daily allowance is 100/user with a 5,000 floor and a
>    50,000 ceiling at 500 users — if it's easier to note a higher tier now than to revisit
>    it when we get there, let me know what you'd need from me.
>
> Thanks for building and running intervals.icu, and for keeping the API open. Happy to
> answer anything else that would help.
>
> [NAME]

---

## When the reply arrives

1. `client_id` and `client_secret` appear under `/settings`. The secret is a **Worker
   secret** (`wrangler secret put INTERVALS_CLIENT_SECRET`), never in `wrangler.toml`.
2. Authorize at `https://intervals.icu/oauth/authorize?client_id=…&redirect_uri=…&scope=ACTIVITY:READ&state=…`,
   exchange at `POST https://intervals.icu/api/oauth/token`. Verify `state` — it is the CSRF
   control on the callback.
3. **Test token lifetime before trusting it.** intervals.icu issues no refresh tokens, only
   access tokens, and there is one unconfirmed report of 403s after a couple of hours. If
   tokens really do expire that fast, per-user OAuth is not seamless and the fallback below
   is the better product. Hold a token for a day and re-call before committing to the flow.
4. A new authorization **replaces** any existing token for that user. Since the token lives
   server-side in the Worker rather than on a device, that is harmless here: one
   authorization, stored once. Re-auth is not routine, contrary to the earlier note in
   [multi-tenant-decision.md](multi-tenant-decision.md).
5. Disconnect is `DELETE https://intervals.icu/api/v1/disconnect-app` with the bearer token.
   Wire it to account deletion, or tokens outlive the accounts they belong to.

**If registration is refused or tokens turn out to expire in hours**, the fallback is a
per-user personal API key, pasted once, AES-GCM encrypted under a Worker secret and never
returned by any read method. Worse in every way except one — unscoped, long-lived and
write-capable — but it needs no approval, and each user gets their own 5,000/day rather than
sharing a pooled app quota. `ownerLink()` in `worker/worker.js` is the seam either way: it
returns `{athlete, auth}`, so a Bearer token drops in beside the Basic key with no change
below it.

---

## Onboarding copy, once it works

Two things to tell users, both of which cost nothing and prevent real problems:

- **Connect the device directly to intervals.icu, not through Strava.** Better data — Strava
  strips left/right power — and it keeps activities out of scope of Strava's AI clause. If
  rides arrive via Strava sync and we feed them to a model, that clause is arguably engaged
  regardless of who made the API call. Consider filtering on the activity source field before
  anything reaches a prompt; confirm the field name against `intervals.icu/api/v1/docs/`.
- **Backfill is free, but not automatic.** Full Strava *history* import is Supporter-only
  ($4/mo); ongoing sync is free. The free route is Strava's own bulk export → upload the ZIP
  to intervals.icu. This matters because `FORM_DAYS` is 180 and CTL needs ~42 days before it
  means anything: without backfill a new rider reads cold, and a cold CTL under-feeds them.
