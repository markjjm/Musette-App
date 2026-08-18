<!-- Draft spec for the public site. Written against the CSP and build tooling that
     actually exist in this repo, not a greenfield assumption. Nothing built yet. -->

# Public website — draft spec

**Status:** draft, for review. The app itself is out of scope; this covers everything a person sees
**before** they are signed in, plus the two pages they reach from inside it (privacy, account deletion).

---

## 1. What this site is for, in priority order

1. **Convert an invited person into an enrolled one.** Nearly all traffic arrives holding an invite link from
   someone they know. The site's main job is to make a stranger comfortable enough to enrol a passkey and
   spend ten minutes on an intake.
2. **Answer "what is this and is it safe" without a demo.** They cannot try it — it is invite-only. So the
   site has to substitute for a trial.
3. **Be somewhere the author can point people.** A link that survives being sent to a coach, a clinician, or
   a sceptical partner.

It is explicitly **not** a growth site. No signup funnel, no waitlist theatre, no pricing table, no blog.

---

## 2. What was wrong with draft one

Recorded so the second attempt does not drift back:

| Problem | Fix |
|---|---|
| Warm paper ground + Georgia serif read as a personal project | Cool neutral ground, sans display, navy carrying authority |
| One long scrolling page pretending to be a site | Real pages with real URLs |
| No credibility signals — no privacy page, no contact, no legal | All three, linked from the footer of every page |
| Voice was a manifesto ("Argue with it", "a reproach that arrives every morning") | Keep the plain-spokenness, drop the aphorisms |
| Amber used decoratively in several places | One accent use per view, and it means "primary action" |
| Nothing showed what the product looks like | Real product surfaces, rendered, not screenshots |

The writing quality was not the problem and should not be flattened into corporate filler. The register to aim
for is a well-made instrument's documentation: precise, unhurried, no adjectives it has not earned.

---

## 3. Pages

| URL | Purpose | Priority |
|---|---|---|
| `/` | What it is, who it is for, how it works, sign in | 1 |
| `/how` | The intake, the plan, changing it, the session read — in depth | 2 |
| `/privacy` | What is held, who processes it, export and deletion, sub-processors | 1 |
| `/access` | Why invite-only, the household ceiling, self-hosting | 3 |
| `/about` | Who made it and why | 3 |
| `/terms` | Terms of use, and the not-a-medical-device statement in full | 1 |
| `/signin` | Passkey, password, invite redemption | 1 |

`/privacy` and `/terms` are priority 1 rather than an afterthought: the product holds Art. 9 special-category
data and the site is the only place the consent basis can be set out before someone hands it over.

---

## 4. Design system

Deliberately **not** the app's palette. The app is a warm paper-and-navy instrument you use at 6 am in a
kitchen; the site is the thing you send to a sceptic. They share the navy and the amber so they are visibly
related, and diverge on ground and type.

**Colour**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ground` | `#F7F8FA` | `#0C1118` | page |
| `--surface` | `#FFFFFF` | `#141B25` | cards, panels |
| `--line` | `#E1E5EB` | `#232C39` | rules, borders |
| `--ink` | `#0F1620` | `#E8ECF2` | body |
| `--ink-2` | `#4A5666` | `#A3AEBD` | secondary |
| `--navy` | `#12305C` | `#0A1626` | brand surface, headers |
| `--navy-ink` | `#F2F5FA` | `#E8ECF2` | on navy |
| `--accent` | `#F0B429` | `#F0B429` | one primary action per view |
| `--train` | `#1F6B4A` | `#6BC79B` | training semantics |
| `--fuel` | `#7A3E86` | `#C79BD2` | nutrition semantics |

Cool neutrals with a slight blue cast toward the navy, so the greys read chosen rather than defaulted. Accent
and the two semantic hues are the only saturated colour on any page.

**Type** — system sans throughout for display and body; monospace for figures, labels and eyebrows. No serif.
No webfonts: the CSP forbids external hosts and inlining a face as a data URI costs more than it returns here.

Scale, fixed: `11 / 12.5 / 14 / 16 / 18 / 22 / 28 / 38 / 52`. Display sizes use `-0.025em` tracking and weight
650–750; uppercase mono labels use `+0.12em`.

**Layout** — 1120 max width, 12-column grid at ≥900px, single column below. Vertical rhythm on a 4px base.
Section padding `clamp(48px, 7vw, 96px)`. Body copy never wider than 68ch.

**Components** — masthead, footer, section header, feature card, product surface (a rendered fragment of the
real UI), question/answer row, exchange block, data list, form field, button (primary / secondary / quiet),
callout, FAQ item.

---

## 5. Content, page by page

**`/` home**

1. Masthead — wordmark, five links, Sign in.
2. Hero — one sentence on what it does, two on who for, primary and secondary action. No image.
3. Two-halves proof — training and nutrition surfaces side by side, each explaining itself.
4. Who it is for — two named people with different constraints and genuinely different plans.
5. How it works — three steps, each linking into `/how`.
6. What it does not do — no feed, no streaks, no ads, no selling data, not a medical device. **This section
   is a credibility signal, not a disclaimer**, and it belongs above the fold of the second screen.
7. Data and privacy summary — four lines, linking to `/privacy`.
8. Sign in.
9. Footer — every page, plus contact, plus the medical statement in one line.

**`/how`** — the intake in full with real answers; what each answer changes; the plan surfaces; the change
exchanges; the session read; devices and how syncing works. This is the page a sceptic reads.

**`/privacy`** — plain language first, formal detail second. What is held, the legal basis, the named
sub-processors (Cloudflare, OpenAI, intervals.icu), retention (the 90-day prune **is** a retention policy and
must be described as one), export, deletion and what deletion does not reach, and how a breach would be
notified given there is no email channel.

**`/signin`** — three routes, in this order: passkey, username and password, invite redemption. States that
must be designed, not discovered: invite valid, already used, expired, malformed; passkey unsupported on this
device; password wrong; account locked; and password reset, which given the no-email design is
**operator-mediated** and must say so honestly rather than showing a dead "forgot password" link.

---

## 6. Technical constraints

These are properties of this repo, and drafting around them is not optional.

- **CSP.** `web/public/_headers` is generated by `tools/build-csp.mjs`, applies to `/*`, and today hashes
  exactly one inline `<style>` and one inline `<script>` from `index.html`. A second page with its own inline
  style renders unstyled. `form-action 'none'` means a real form POST is blocked.
  **Required work:** generalise `build-csp.mjs` from one file to N, emitting per-path blocks in `_headers`,
  and set `form-action 'self'` only on the paths that need it. `tools/scan.mjs` must then check every page,
  not just `index.html`.
- **Zero runtime dependencies.** No framework, no bundler, no webfont, no analytics script. Asserted by
  `scan.mjs` §8 and it stays true.
- **Static.** Cloudflare Pages serves files. No SSR. Sign-in talks to the Worker via `fetch`.
- **Images** are `data:` URIs or nothing — `img-src data:` is the whole allowance.
- **One page, one file.** Matches how the app is built and keeps the CSP hashing tractable.

## 7. Accessibility and performance

WCAG 2.2 AA as the floor: 4.5:1 on body text, visible focus on every interactive element, landmarks, one `h1`
per page, `prefers-reduced-motion` honoured, and every state distinguishable without colour. Keyboard path
through sign-in tested before launch, since it is the only page that must work under pressure.

Budget: under 60 KB per page uncompressed, no blocking requests beyond the document, largest paint under one
second on a mid-range phone. This is achievable because there is nothing to load.

## 8. Deliberately excluded

Pricing page (it is free and invite-only), blog, testimonials, cookie banner (no cookies before sign-in),
newsletter, live chat, social links, and any claim of clinical benefit.

## 9. Build order

1. Generalise `build-csp.mjs` to multiple pages; extend `scan.mjs` to check all of them. **Nothing else can
   ship first.**
2. `/` at the new visual direction, with `/privacy` and `/terms` as plain pages.
3. `/signin` with all states, wired to the Worker once auth exists.
4. `/how`, then `/access` and `/about`.
