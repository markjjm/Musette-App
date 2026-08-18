<!-- Spec, not a proposal. Sized against the limits verified from Cloudflare's own
     pricing page on 2026-08-13 and against the defects the August audit found in
     the single-tenant code. Nothing here is built yet. -->

# Per-user coach memory — spec

**Status:** design. Depends on the `plan` split (build order step 6) and per-member auth (step 5).

The coach today is stateless. Every call assembles facts from the plan and the last few weeks of rides, asks
a question, and throws the context away. That is why it cannot say *"this is the third long ride in a row you
have under-fuelled"* — it has never met you before.

---

## 1. Three layers, and the boundary between them is the point

| Layer | Key | Written by | Survives a rebuild |
|---|---|---|---|
| **Stated** | `u:<uid>:profile` | the user, via intake and edits | yes — it is the source |
| **Observed** | `u:<uid>:notes` | code, from measured data | yes |
| **Inferred** | `u:<uid>:notes` | the model, proposing | yes, but labelled |
| **Digest** | `u:<uid>:digest` | code, derived | no — regenerate from the above |

Three layers rather than one blob because **an inference must never be able to overwrite a fact.** That is the
same rule the app already enforces on the plate: `macroRow()` shows a `?` rather than let a day-type template
clear the low-fat warning, and `ANALYST_SYSTEM` gets arithmetic as settled fact rather than being asked to do
it. Memory is where that rule is easiest to break and most expensive to have broken — a model that decides
you are "probably fine with gluten" and writes it next to a coeliac diagnosis is a different class of bug
from a wrong calorie count.

So: **`profile` is only ever written by the user.** The model can propose a change to it; the proposal
surfaces as a question in the app, and a human answers.

---

## 2. What each layer holds

**`u:<uid>:profile`** — stated, structured, small. Sports and typical volume; the days and durations they can
train; the goal and its date; medical and dietary limits with a `hard: true` flag; foods refused; equipment;
who else eats at the table. Every field is one the intake asked for, and every field is editable in one tap.
Cap **4 KB**.

**`u:<uid>:notes`** — a list. Each note is:

```js
{ t: 1786…,             // when it was made
  kind: 'observed' | 'inferred',
  text: '…',            // <= 280 chars, one claim
  basis: 'ride 2026-08-22, 44 g/h against 80 planned',   // required for 'observed'
  conf: 'high' | 'medium' | 'low',                        // 'inferred' is never 'high'
  n: 3 }                // how many times seen; increments rather than duplicating
```

`observed` notes are written **by code**, from figures the code computed — "under-fuelled by more than 30%
on 3 of the last 4 rides over three hours" is arithmetic, not judgement. `inferred` notes are the model's
reading — "responds badly to two hard days back to back" — and carry its uncertainty. Cap **200 notes**,
each ≤ 280 chars.

**`u:<uid>:digest`** — the ~1,500 token summary that actually goes in the prompt, regenerated when notes
change materially. Derived and disposable: deleting it costs nothing because it rebuilds. Cap **2 KB**, and
that cap is the cost control, because this text rides in *every* model call.

---

## 3. Caps are not optional here, and today's audit says why

The August audit's worst finding was an entry ceiling that counted loop iterations instead of the resource,
so one 79 KB request built a map whose round trip was 329 KB and wedged sync for both phones permanently.
Memory is exactly that shape again: a per-user store that grows on every activity, forever, with no natural
bound.

Three ceilings, all on the resource:

1. **Note count** — 200. Adding the 201st drops the lowest-value existing note (oldest × lowest confidence),
   it does not refuse the write. Memory should forget, not jam.
2. **Digest bytes** — 2 KB, enforced at generation. If the digest would exceed it, the generator drops the
   lowest-value notes and regenerates rather than truncating mid-sentence.
3. **Total per-user bytes** — counted into the same `syncedWire()` ceiling the state already prices against
   `MAX_BODY`, so a household of four cannot quietly build a state no phone can pull.

Prune on the same 90-day clock as the rest of the log, with one exception: notes derived from `profile`
medical limits never age out.

---

## 4. The model proposes; code writes

The model never writes to storage. After an activity read it may return, in its structured output:

```
memory: [ { op: 'add' | 'reinforce' | 'retire', ref?: '<note id>', text?: '…', conf: '…' } ]
```

Code validates every op against the schema, enforces the caps, refuses any op touching `profile`, and applies
what survives. This is the same posture as `cleanLog()` and `cleanDish()` — a whitelist that drops what it
does not recognise — and it inherits the same known trap, recorded here so the next person does not rediscover
it: **a validator that lists its fields silently deletes any field a later feature adds.** That has already
cost this app one feature (`dish.ai`) and nearly cost it another today. If the note shape grows, grow the
validator in the same commit.

---

## 5. What it costs

The digest is in every prompt. At 2 KB (~500 tokens) against a `gpt-5-mini` call, that is a small fraction of
a coach call and a meaningful fraction of a cheap one.

The real multiplier is **a read on every activity**, which is a new call that did not exist. The current
breaker is `COACH_MAX_DAY = 40` calls a day across one household. For 50 households each recording one
activity a day, activity reads alone are 50 calls a day before anyone asks a question. `BudgetDO` with
cents-denominated spend (build order step 4) must land **before** activity reads ship, not after.

Cheap mitigations, in order of how much they buy: only read activities over a threshold duration; batch a
day's activities into one read; skip the read entirely when the session matched its prescription within
tolerance, and say so in one code-generated line instead.

---

## 6. It is the user's, and it is deletable

The digest and notes are health inferences about a person. They are covered by the same Art. 17 and Art. 20
obligations as the food log:

- **Export** returns `profile`, `notes` and `digest` in full, as JSON, with the `basis` field intact — a
  person is entitled to see what was concluded about them and on what evidence.
- **Deleting a member** wipes `u:<uid>:*`. Note the residue the audit already catalogued: the DO's `prev`
  snapshot holds a complete copy of prior state, so deletion must clear `prev` too or the memory outlives the
  member by one revision.
- **A user can retire any single note** from the app, without deleting anything else. If the coach has
  concluded something wrong or unwelcome about you, you can say so and it goes.

---

## 7. Build order

Fits after step 6 (`plan` split) because it needs `u:<uid>:` to exist, and after step 4 (`BudgetDO`) because
activity reads are what make it expensive.

1. `profile` written by intake, read into the existing coach prompt. No notes, no digest — measure whether a
   stated-facts-only prompt already improves the advice before building the rest.
2. `observed` notes from code, on the figures already computed today (fuelling versus plan, ramp rate,
   adherence). Still no model writes.
3. The digest generator and the 2 KB cap.
4. `inferred` notes and the propose-validate-apply loop.
5. Per-note retire in the UI, export, and the `prev` clearing on delete.

Steps 1 and 2 need no model changes at all and are where most of the "it knows me" feeling comes from.
