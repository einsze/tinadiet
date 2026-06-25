---
title: Stack
description: The backend stack, framework choices, and project structure.
sidebar:
  order: 1
---

The backend is a single Express process running on Railway. TypeScript ESM,
Node 22, all dependencies pinned to caret ranges.

## Stack at a glance

| Layer | Choice | Pinned |
|---|---|---|
| Runtime | Node 22 LTS | `engines.node = "22.x"` |
| Language | TypeScript 5.6 strict + ESM | `tsconfig` extends strictest |
| HTTP | Express 4 | `^4.21.1` |
| DB driver | better-sqlite3 | `^12.10.0` — sync, native binding |
| Validation | Zod 4 | `^4.4.3` |
| Session | jsonwebtoken | `^9.0.3` — HS256 |
| Admin password hash | bcryptjs | `^3.0.2` — pure JS (Windows path-with-spaces safe) |
| LINE | `@line/bot-sdk` v9 | `^9.6.0` |
| OpenAI | `openai` SDK v6 | `^6.42.0` |
| Stripe (dormant) | `stripe` v22 | `^22.2.0` |
| PromptPay QR | `promptpay-qr` + `qrcode` | EMVCo payload + PNG render |
| Slip uploads | `multer` | `^2.0.x` — memoryStorage → disk |
| Cron | `node-cron` | `^4.2.1` |
| Dev runner | `tsx` | `^4.19.1` |

**No ORM, no Express-X framework, no DI container.** Pragmatic plain
patterns; lazy stmts in repositories is the only convention forcing your
hand.

## Project layout

```
backend/src/
├── ai/             OpenAI client + model selection
├── auth/           Session JWT issue + verify
├── config/
│   └── env.ts      Single source for env vars (typed)
├── db/
│   ├── sqlite.ts   Db instance + helpers
│   ├── migrate.ts  Runner that applies migrations on boot
│   └── migrations.ts  Versioned schema
├── domain/         Pure business logic (no I/O):
│   ├── types.ts    All shared types
│   ├── nutrition.ts BMR/TDEE math
│   ├── profile.ts  isProfileComplete, isPremium
│   ├── streak.ts   Streak computation
│   └── date.ts     todayInTimezone helper
├── errors/         Custom error classes
├── jobs/           Cron handlers:
│   ├── index.ts    Schedules
│   ├── daily_summary.ts
│   ├── weekly_summary.ts
│   ├── expire_premium.ts
│   ├── renewal_reminders.ts
│   └── expire_gifts.ts
├── line/
│   └── client.ts   LINE SDK wrapper (reply, push, fetch message content)
├── middleware/
│   ├── auth.ts     requireAuth — verify session JWT
│   └── admin_auth.ts  requireAdmin / requireSuperadmin
├── repositories/   DB access (lazy stmts):
│   ├── users.ts
│   ├── food_logs.ts
│   ├── weight_logs.ts
│   ├── chat_messages.ts
│   ├── subscriptions.ts (Stripe, dormant)
│   ├── payments.ts      (Omise, dormant)
│   ├── admin_users.ts
│   ├── manual_payments.ts
│   ├── credit_ledger.ts
│   ├── system_settings.ts
│   ├── user_flags.ts
│   ├── user_themes.ts
│   └── gifts.ts
├── routes/
│   ├── api/        LIFF-facing /api/v1/* + admin/* sub-tree
│   ├── webhook/    line.ts, stripe.ts, omise.ts
│   └── internal/   jobs.ts (cron triggers, secret-gated)
├── services/       Coordination + external API:
│   ├── food_parser.ts        (OpenAI text + vision)
│   ├── coach.ts              (OpenAI meal suggestions)
│   ├── consultation.ts       (OpenAI Q&A)
│   ├── credit.ts             (atomic credit ledger mutation)
│   ├── manual_payment.ts     (top-up lifecycle)
│   ├── premium_redemption.ts (credit → premium days)
│   ├── gifts.ts              (peer-to-peer gift system)
│   ├── promptpay_qr.ts       (server-render PromptPay EMVCo QR)
│   ├── slip_storage.ts       (multer-based slip uploads)
│   ├── abuse_flag.ts         (tiered abuse-warning logic)
│   ├── admin_auth.ts         (bcrypt + admin JWT)
│   ├── stripe.ts             (dormant)
│   └── omise.ts              (dormant)
├── utils/          Generic helpers
└── index.ts        App entry — mount routes, start cron, listen
```

## Conventions

### Layering

A loose Clean Architecture cut:

```
routes  →  services/use-cases  →  repositories  →  db
   │            │
   │            └─→ external APIs (OpenAI, LINE, Omise)
   │
   └─→ domain (pure)
```

- **`domain/`** is pure: no I/O, no external imports beyond other domain
  files. Easy to unit test.
- **`repositories/`** wrap `db` only. No business logic, no external calls.
- **`services/`** coordinate: call repos + external APIs + domain.
- **`routes/`** are thin HTTP adapters: parse, validate, call service,
  serialize response.

### ESM imports

All `.ts` files use ESM with explicit `.js` extensions in import paths
(required for Node ESM resolution post-build):

```ts
import { userRepository } from '../repositories/users.js';
import type { User } from '../domain/types.js';
```

Yes, `.js` even though the file is `.ts` — TypeScript compiles `.ts` →
`.js` so the path is correct post-build.

### Logging

Structured JSON to stdout/stderr (Railway captures both, queryable in
their UI):

```ts
console.log(
  JSON.stringify({
    level: 'info',
    msg: 'webhook.omise.handled',
    event_id: event.id,
    db_user_id: result.user_id,
    ...
  })
);
```

Format: `level`, `msg` (dotted noun.verb), then key fields. Avoid
free-form log strings; structured fields are searchable.

### Error handling

- Throw custom error classes from services (e.g. `OmiseServiceError`)
- Routes catch and convert to JSON response with `{error: {code, message}}`
- Background jobs catch + log but don't crash the process

### Async patterns

- Webhook handlers ACK 200 fast, then process async with try/catch
- No promise chains; always `await` or wrap in `void load()` for fire-and-forget
- DB calls are SYNCHRONOUS (better-sqlite3) — no `await` needed for queries

## Anti-patterns to avoid

- **Don't use `db.prepare()` at module top level.** Use lazy `stmts()`
  getter. See [Key invariants](/docsfordevtina/architecture/key-invariants/).
- **Don't put business logic in routes.** Push it down to services.
- **Don't use `any`.** TypeScript strict mode catches missing types — fix
  the type, not the suppression.
- **Don't log secrets.** Sanitize bodies before logging webhook payloads
  if you must log them.
- **Don't fail webhooks on handler errors.** ACK 200 first; log the failure.
