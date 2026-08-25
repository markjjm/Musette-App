# Musette 🎒🍲

> **The sovereign lifestyle fueling and meal-planning system built for active, high-performing people.**

Musette bridges the gap between daily physical training across any sport and practical, delicious nutrition in your kitchen. Built for runners, cyclists, triathletes, lifters, and everyday active people with busy lives who want intelligent, automated meal planning without expensive coaching fees or subscription paywalls.

🌐 **Website**: [musetteapp.com](https://musetteapp.com)  
📱 **Live Web App**: [shopping-list-app-9an.pages.dev](https://shopping-list-app-9an.pages.dev)  
⚡ **Sync API**: [api.musetteapp.com](https://api.musetteapp.com)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers & Pages](https://img.shields.io/badge/Hosting-Sovereign_$0/mo-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Zero-Build PWA](https://img.shields.io/badge/Architecture-Single--File_PWA-10B981)](#-architecture--layout)
[![Security: Strict CSP](https://img.shields.io/badge/Security-SHA256_CSP_%26_Zero_Tracking-success)](SECURITY.md)

---

## 🎒 Why "Musette"?

In endurance athletics, a ***musette*** is the iconic cotton feed bag handed to athletes mid-effort. Packed with purposeful nourishment, hydration, and energy, it provides exactly what the body needs to keep moving forward without slowing down.

Musette brings that same philosophy to your everyday life: **simple, high-quality nourishment handed to you on the go, built to power your active lifestyle without adding complexity to your schedule.**

---

## 🎯 The Vision: Fueling Built Around Any Sport, Any Schedule

Whether you're training for a marathon, putting in miles on the bike, swimming laps, lifting, or simply balancing a demanding career and family, traditional fitness platforms fall short:

- **Data Without Action**: Garmin, Apple Health, Strava, and TrainingPeaks record what you did yesterday, but leave you guessing how many calories, carbohydrates, and nutrients your body actually needs to recover for tomorrow.
- **Generic Diets Don't Work for Active Lives**: Restrictive 1,500-calorie diet apps leave active people exhausted, under-fueled, and fighting late-afternoon brain fog and midnight pantry cravings.
- **The Kitchen Execution Friction**: Knowing your target nutrition is only half the battle. Converting numbers into weekly family dinners, organized grocery store trips, and pantry inventory takes hours of mental energy that busy people simply don't have.

**Musette solves this across every sport.** It automatically scales your daily nutrition targets to your training output, connects them to a curated 100-meal recovery recipe catalog, and generates an aisle-organized supermarket shopping list in a single tap.

---

## ⚡ How It Works

```
  🏃‍♂️ Real Training Output (Running, Cycling, Swimming, Gym, Multi-Sport)
         │
         ▼
  📊 intervals.icu / Device Direct Sync (Mechanical Work & Energy Burn)
         │
         ▼
  ⚡ Musette Metabolic Physics Engine
     ├── Calculates Basal Energy (BMR) + Dynamic Workout Expenditure
     ├── Periodizes Daily Carbohydrates (Rest Day: 3–4 g/kg ➔ High Volume: 8–10+ g/kg)
     └── Delivers Instant Workout Debriefs & Glycogen Replenishment Targets
         │
         ▼
  🍽️ 100-Meal Recovery Catalog (Calibrated Whole-Food Macros)
     ├── 🍳 Single-Pan & Sheet-Pan Filters (Minimal kitchen cleanup)
     ├── ⏱️ <20-Minute Quick Prep Meals (Fast dinners after late sessions)
     └── Dynamic Portion Scaling based on actual expenditure
         │
         ▼
  🛒 Aisle-Sorted Grocery Checklist
     ├── Automatically groups ingredients by physical Supermarket Aisle
     └── Tracks Pantry Staples (Low/Out status automatically queues items)
```

---

## 🌟 Built For Real Lives (Key Features)

### 1. 🍽️ Real Food That Fits a Busy Schedule
No boiled chicken or chalky powders. Musette features **100 tested, delicious, whole-food recipes** calibrated for active recovery — smash burgers on brioche, honey garlic chicken jasmine bowls, slow-cooked beef ragù, Mediterranean salmon, chicken fajitas, and steak tacos:
- **🍳 Single-Pan Shortcut**: Filter instantly for one-pot and sheet-pan meals with minimal kitchen cleanup.
- **⏱️ <20-Min Quick Prep**: Fast recovery dinners ready in minutes after a late workout.
- **One-Tap Grocery List Sync**: Tap `+ List` on any recipe to instantly queue all ingredients; tap `✓ In List ✕` to remove them with zero leftover clutter.

### 2. ⚡ Dynamic Nutrition Periodization
Your body needs different fuel on rest days versus hard training days. Musette periodizes your daily targets based on the demands of your schedule:
- **Rest / Recovery Days**: $3.0 - 4.0\text{ g/kg}$ (Nutrient-dense whole foods, recovery fats).
- **Aerobic Base Days (1–2h)**: $5.0 - 7.0\text{ g/kg}$ (Moderate glycogen replenishment).
- **Threshold / Key Workout Days**: $7.5 - 9.5\text{ g/kg}$ (Targeted high-glycogen fueling).
- **Epic Volume Days (3h+)**: $10.0+\text{ g/kg}$ (Complete glycogen replenishment + active session fueling).

### 3. 🛒 Automated Aisle-Organized Grocery Lists
Instead of a disorganized mess of ingredients, Musette automatically consolidates your weekly meal choices and pantry staples into physical supermarket aisles:
- 🥦 **Produce**: Fresh greens, fruits, root vegetables, citrus, fresh herbs.
- 🥩 **Meat & Seafood**: Lean poultry, flank steak, salmon, ground turkey.
- 🥛 **Dairy & Eggs**: Greek yogurt, cheeses, eggs, milk.
- 🍞 **Bread & Grains**: Sourdough, jasmine rice, oats, pasta, tortillas.
- 🥫 **Pantry & Staples**: Black beans, crushed tomatoes, olive oil, seasonings.

### 4. 🥫 One-Tap Pantry Management
Keep your kitchen stocked effortlessly. Flag pantry items as **Low** or **Out** with a single tap, and they automatically appear in your active shopping list.

---

## 📁 Layout

```
plan.json                   Source of truth for the current block's meal plan
tools/publish-plan.py       Push plan.json to the Worker; phones pick it up on sync
web/public/index.html       The entire app — one self-contained, lightning-fast file
web/public/_headers         GENERATED. Security headers + strict SHA-256 hash-based CSP
web/site/                   Public informational & onboarding site
worker/worker.js            Sync API: GET/PUT /state, PUT /plan, GET /health, Auth
worker/wrangler.toml        Durable Object + SQLite binding (secrets are not in here)
tools/build-csp.mjs         Regenerates _headers from index.html
tools/build-meals.mjs       Validates and builds the 100-recipe recovery catalog
tools/scan.mjs              Security regression scan
tools/interp-baseline.json  Reviewed-safe HTML interpolations
```

---

## 🛠️ Commands

```sh
npm run check         # CSP freshness + security scan + test suite (run before deploying)
npm run build         # Regenerate _headers after editing index.html
npm run scan          # Security regression scan only
npm test              # Run all 15 automated test suites

npm run dev:web       # Serve the app at localhost:8788 (with real headers)
npm run dev:worker    # Run the sync Worker at localhost:8787

npm run deploy:web    # Builds, then deploys Cloudflare Pages
npm run deploy:worker # Deploys the Cloudflare Worker
```

Local Worker dev reads secrets from `worker/.dev.vars` (gitignored, dummy values). Copy `worker/.dev.vars.example` to get started.

---

## 📅 Updating the Meal Plan

The app provides dedicated tabs: **Shop** (Grocery checklist & Pantry), **Dinners** (Weekly schedule & 100-recipe catalog), **Eat** (Daily fueling schedule with workout hours, kcal/carb targets, and timed meals), and **Train** (Live activity cards and coach analysis).

Two ways to ship a new monthly block:

```sh
# 1. Bundle it (needed for a fresh device with no sync configured)
#    Replace the BUNDLED const in web/public/index.html with plan.json's "plan"
#    object, then rebuild the CSP hash and deploy:
npm run build && npm run deploy:web

# 2. Publish it to the Worker — every phone picks it up on its next sync,
#    no redeploy, no reinstall:
export LIST_URL=https://api.musetteapp.com
export LIST_KEY=...   # your shared list key
export ADMIN_KEY=...  # your admin key
python3 tools/publish-plan.py plan.json      # pass --keep-ticks to preserve check-offs
```

Do both when the block changes: (2) updates connected phones immediately, (1) ensures a freshly installed device shows the right plan before it has ever synced.

---

## ✏️ Editing the App

`web/public/index.html` is the whole front end. **After editing it, run `npm run build`** — the CSP pins a SHA-256 hash of the inline script, and a stale hash will white-screen the app. The pre-commit hook does this for you; `npm run check` catches it if not.

If you add a new value into rendered HTML, wrap it in `esc()`. The scan will fail on any interpolation it has not seen before; review it, then approve with `npm run scan:baseline`.

---

## 🤖 Automation & Security

| When | What |
|---|---|
| **pre-commit** | Regenerate CSP, run the security scan |
| **every push / PR** | Scan + CodeQL `security-extended`, both blocking |
| **merge to main** | Deploy Worker + Pages, then verify the live CSP and Worker auth |
| **weekly** | Scan, plus a live check that production still serves the CSP and the Worker returns 401 unauthenticated |
| **weekly** | Dependabot for CI actions and wrangler; patch/minor auto-merge on green |
| **every PR** | Socket.dev supply-chain review of the dependency tree (see `socket.yml`) |

CI needs two repo secrets: `CLOUDFLARE_API_TOKEN` (Workers + Pages edit) and `CLOUDFLARE_ACCOUNT_ID`.

See [SECURITY.md](SECURITY.md) for the threat model and the architectural controls.

---

## 📄 License

Musette is open-source software licensed under the permissive [MIT License](LICENSE).
