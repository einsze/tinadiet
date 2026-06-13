---
title: Key Invariants
description: Patterns and rules that must not be broken.
sidebar:
  order: 3
---

These are the non-negotiable patterns in the codebase. Breaking any of them
has historically caused production incidents. If you're tempted to bend one,
document the reasoning in an ADR and update this page.

## 1. Lazy-init prepared statements

**Rule**: Never call `db.prepare(...)` at module top level. Always wrap in a
lazy getter.

**Pattern** (used in every repository):

```ts
import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';

type Stmts = {
  findById: Statement;
  insert: Statement;
  // ...
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    findById: db.prepare('SELECT ... FROM ... WHERE id = ?'),
    insert: db.prepare('INSERT INTO ... VALUES (...)'),
    // ...
  };
  return _stmts;
};

export const fooRepository = {
  findById: (id: number) => stmts().findById.get(id),
  // ...
};
```

**Why**: ESM imports are hoisted. If a repository module is imported at
top-level by `index.ts`, `db.prepare()` runs **before** `runMigrations()`
has created the tables. SQLite errors with "no such table". Lazy init
defers the prepare until first actual use.

This bit us early in Sprint 1 — see `feedback_esm_hoisting_breaks_top_level_db_prepare`
memory.

## 2. Express webhook routes BEFORE `express.json()`

**Rule**: Mount webhook routers in `index.ts` **before** `app.use(express.json())`.

```ts
// CORRECT
app.use('/webhook', lineWebhookRouter);     // signature verify, then express.json
app.use('/webhooks', stripeWebhookRouter);  // uses express.raw
app.use('/webhooks', omiseWebhookRouter);   // uses express.raw

app.use('/api/v1', cors(...));
app.use(express.json({ limit: '256kb' }));  // ← AFTER webhooks

app.use('/api/v1', apiV1Router);
```

**Why**: Stripe and Omise webhooks require the raw request body bytes for
HMAC signature verification. `express.json()` consumes the stream and
replaces `req.body` with a parsed object — by the time the webhook handler
runs, the original bytes are gone. The webhook router uses
`express.raw({type: 'application/json'})` to preserve bytes; this only works
if no global JSON parser ran first.

## 3. Payment idempotency via early return

**Rule**: Webhook handlers must be idempotent. Same event delivered twice
must produce the same final state (and not double-charge or double-grant).

**Pattern**: Check `payment.status === 'successful'` early and return.

```ts
// services/omise.ts handleOmiseEvent
if (payment.status === 'successful') {
  return { handled: true, ... };  // no-op, already processed
}
```

**Why**: Omise (and Stripe) retry webhooks on non-2xx response. They can
also legitimately deliver the same event multiple times. The `(provider,
provider_charge_id)` UNIQUE index gives us reliable identification; the
status check prevents duplicate grants.

## 4. Always ACK webhook before async work

**Rule**: Return `res.status(200).json({received: true})` **before** doing
expensive work. Use try/catch around the async handler, log failures.

```ts
// Stripe + Omise webhook routes follow this pattern
res.status(200).json({ received: true });

try {
  const result = await handleEvent(event);
  console.log(...);
} catch (err) {
  console.error(...);
}
```

**Why**: Webhook senders (Omise, Stripe, LINE) treat any non-2xx as
delivery failure and retry. If our handler is slow (DB write + grant
computation), they may retry before we finish, leading to thundering herd.
ACK fast, process async; idempotency (rule 3) covers re-deliveries.

## 5. Thai-first content, English chrome

**Rule**: User-visible text in Thai with `ค่ะ` polite female register. UI
controls (button labels for inputs, navigation tabs) stay English.

Examples:
- Bot reply: "เยี่ยมมาก! บันทึกแล้วค่ะ ผัดกะเพราไก่ 450 kcal"
- Button: "Save & calculate goals" (NOT "บันทึก")
- Nav: "Home / Premium / Profile / Support" (NOT "หน้าแรก / ฯลฯ")
- Onboarding form field labels: "Gender", "Height" (English)
- Onboarding form field options: "Female", "Sedentary" (English)

**Why**: Thai-first content because target users are Thai. English chrome
because Thai LINE users are accustomed to English UI elements (they appear
across most apps), and it's faster to scan. Memory captures detail —
`feedback_i18n_thai_first` — but not currently a separate memory file.

## 6. Profile-gated AI features

**Rule**: Any feature that consumes OpenAI must check `isProfileComplete()`
first. If not complete, redirect via `profileGateText` in webhook, or
disable the UI in LIFF.

```ts
// webhook handler
if (!isProfileComplete(user)) {
  await lineReply(replyToken, profileGateText);
  return;
}
// ... call AI
```

**Why**: AI parsing references user's nutrition goals (e.g. "ผัดกะเพรา 600
kcal — เหลือ 800 kcal เท่านั้นวันนี้"). Without goals computed, the response
is generic and misses the value prop. Also limits the abuse blast radius
(no goals = harder for spam users to consume our OpenAI budget).

## 7. Premium-gated paid features

**Rule**: Photo logging, consultation Q&A, and LIFF chat panel ALL check
`isPremium(user)` before consuming AI tokens.

Check happens at THREE layers (defense in depth):
1. Webhook handler `handleImageEvent` + `handleConsultation` top check
2. LIFF chat panel disabled via `isPremium` prop
3. API endpoint `POST /api/v1/chat/messages` returns `403 PREMIUM_REQUIRED`

**Why**: AI cost is the marginal cost we monetize against. Three layers
protect against bypasses: bot-only, LIFF-only, or direct API abuse.

## 8. Money in integer subunits

**Rule**: Currency stored as `INTEGER` in subunits. THB has 100 satang;
150 THB = 15000 satang.

```ts
amount_satang: 15000   // ✅
amount_thb: 150.00     // ❌ never
```

Convert for display only at the boundary: `amount_satang / 100`.

**Why**: Floating-point arithmetic on money is a footgun. Omise API itself
uses satang. Stripe uses cents. Both APIs reject decimal amounts.

## 9. Premium grant stacking via `max(now, expiry)`

**Rule**: When applying a new grant period, the new `premium_expires_at`
must be computed as:

```
new_expiry = max(now, current_expiry) + grant_days
```

Implementation in `services/omise.ts` `computeGrantWindow()`.

**Why**: User who pays again before expiry must not lose remaining days.
If we always added from `now`, paying 5 days before expiry would result in
30 days from now = 25 days lost. Stacking adds to the end of the current
period.

## 10. CASCADE deletes for user data

**Rule**: All tables referencing `users` have `ON DELETE CASCADE`. Account
deletion via `POST /api/v1/account/delete` (PDPA compliance) hard-deletes
the user row and cascades to all dependent data.

**Why**: Thai PDPA requires honoring deletion requests. Soft delete creates
ambiguity and audit headaches; hard delete with cascade is unambiguous.
Stripe + Omise customers are best-effort deleted before the local hard
delete (failures logged but non-fatal — we still delete local data).

## 11. Single source of truth for `isPremium`

**Rule**: Frontend and backend both compute `isPremium` from `users.plan +
premium_expires_at` using identical logic. No precomputed boolean stored.

- Backend: `domain/profile.ts` `isPremium(user)`
- LIFF: `lib/premium.ts` `isPremium(user)` (mirror)

**Why**: Storing a precomputed flag means we'd need to update it on every
expiry tick. With the current pattern, expiry is automatic from the
`premium_expires_at` check; the daily `expire_premium` cron is only for
flipping the `plan` field to keep the UI accurate.

## 12. Always pass timezone to `node-cron`

**Rule**: Every `cron.schedule` call includes `{ timezone: 'Asia/Bangkok' }`.

```ts
cron.schedule('0 21 * * *', handler, { timezone: env.CRON_TZ });
```

**Why**: Server may run in UTC (Railway default). Without explicit TZ, "21:00"
means 21:00 UTC = 04:00 Thai next day → users get notifications at 4 AM.
`Asia/Bangkok` is the only correct value for this project.

---

If you find yourself violating one of these and can justify it, **write an
ADR** under `decisions/` and update this page.
