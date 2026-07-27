# Shopping list

Family meal-plan and grocery list. Cloudflare Pages front end, Cloudflare Worker
for cross-device sync.

- App: https://shopping-list-app-9an.pages.dev
- Sync: https://shopping-list-sync.markpjacobs1.workers.dev
- Cloudflare account: `9f2fda20777a150b6eeec70cfd8d6d6d` (markpjacobs1@gmail.com)

## Layout

```
web/public/index.html   the entire app - one self-contained file
web/public/_headers     GENERATED. Security headers + hash-based CSP.
worker/worker.js        sync API: GET/PUT /state, PUT /plan, GET /health
worker/wrangler.toml    KV binding + rate limiter (secrets are not in here)
tools/build-csp.mjs     regenerates _headers from index.html
tools/scan.mjs          security regression scan
tools/interp-baseline.json  reviewed-safe HTML interpolations
```

## Commands

```sh
npm run check         # CSP freshness + security scan (run this before deploying)
npm run build         # regenerate _headers after editing index.html
npm run scan          # security regression scan only

npm run dev:web       # serve the app at localhost:8788 (with real headers)
npm run dev:worker    # run the sync Worker at localhost:8787

npm run deploy:web    # builds, then deploys Pages
npm run deploy:worker # deploys the Worker
```

Local Worker dev reads secrets from `worker/.dev.vars` (gitignored, dummy values).

## Editing the app

`web/public/index.html` is the whole thing. **After editing it, run `npm run build`**
— the CSP pins a sha256 of the inline script, and a stale hash white-screens the
app. The pre-commit hook does this for you; `npm run check` catches it if not.

If you add a new value into rendered HTML, wrap it in `esc()`. The scan will fail
on any interpolation it has not seen before; review it, then approve with
`npm run scan:baseline`.

## Automation

| When | What |
|---|---|
| pre-commit | regenerate CSP, run the scan |
| every push / PR | scan (blocking) + CodeQL (advisory — needs GHAS on a private repo) |
| merge to main | deploy Worker + Pages, then verify the live CSP and Worker auth |
| weekly | scan, plus a live check that production still serves the CSP and the Worker still returns 401 unauthenticated |
| weekly | Dependabot for CI actions and wrangler; patch/minor auto-merge on green, majors wait |

CI needs two repo secrets: `CLOUDFLARE_API_TOKEN` (Workers + Pages edit) and
`CLOUDFLARE_ACCOUNT_ID`.

See [SECURITY.md](SECURITY.md) for the threat model and the controls.
