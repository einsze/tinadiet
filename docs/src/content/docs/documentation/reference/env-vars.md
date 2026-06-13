---
title: Environment Variables
description: Complete reference of all env vars used by backend, LIFF, and docs.
sidebar:
  order: 1
---

All environment variables across the three projects. Source of truth lives
in each project's `.env.example` file; this page mirrors them with
descriptions.

## Backend (`projects/backend/.env`)

### App

| Var | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Standard Node env |
| `PORT` | `3000` | HTTP listen port |
| `LOG_LEVEL` | `info` | Reserved for future logger config |
| `TZ` | `Asia/Bangkok` | Process timezone (also used in cron) |
| `APP_BASE_URL` | `http://localhost:3000` | Self URL for callbacks (rarely used) |
| `LIFF_URL` | `https://app.tinadiet.com` | LIFF URL for any deep-link generation (rarely used) |

### Security (REQUIRED)

| Var | Description |
|---|---|
| `SESSION_JWT_SECRET` | HS256 secret for backend session JWTs. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Rotating invalidates all sessions.** |

### Database

| Var | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./data/app.db` | SQLite file path. Production: `file:/data/app.db` (Railway volume) |

### LINE Messaging API (REQUIRED for bot)

| Var | Description |
|---|---|
| `LINE_CHANNEL_ID` | From LINE Developers Console |
| `LINE_CHANNEL_SECRET` | Used for webhook signature verification |
| `LINE_CHANNEL_ACCESS_TOKEN` | Long-lived token for Reply / Push API |

### LINE Login (REQUIRED for LIFF auth)

| Var | Description |
|---|---|
| `LINE_LOGIN_CHANNEL_ID` | LIFF channel's Login Channel ID, used to validate LIFF access tokens |

### OpenAI (REQUIRED for AI features)

| Var | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | `''` | API key. Empty → AI features 503. Format `sk-proj-...` |
| `OPENAI_MODEL` | `gpt-4o-mini` | Text model for food parsing, coach, consultation |
| `OPENAI_VISION_MODEL` | `gpt-4o` | Vision model for photo food logging |
| `OPENAI_VISION_DETAIL` | `auto` | `low` / `high` / `auto` — `low` for cost |
| `OPENAI_TIMEOUT_MS` | `10000` | Per-request timeout |
| `PHOTO_DAILY_LIMIT` | `10` | Per-user daily photo cap (premium feature) |
| `CONSULT_DAILY_LIMIT` | `20` | Per-user daily consultation questions cap |
| `CONSULT_HISTORY_MINUTES` | `120` | Multi-turn context window |
| `CONSULT_HISTORY_MAX_MESSAGES` | `10` | Max messages in LLM prompt |

### Cron

| Var | Default | Description |
|---|---|---|
| `CRON_ENABLED` | `true` | Set `false` to disable all scheduled jobs |
| `CRON_TZ` | `Asia/Bangkok` | Timezone for all cron schedules |
| `DAILY_SUMMARY_CRON` | `0 21 * * *` | When to fire daily push |
| `WEEKLY_SUMMARY_CRON` | `0 8 * * 1` | When to fire weekly push (Mon morning) |
| `EXPIRE_PREMIUM_CRON` | `0 2 * * *` | When to sweep expired premium users |
| `JOBS_TRIGGER_SECRET` | `''` | Required to call `/internal/jobs/*` endpoints |

### Stripe (DORMANT)

| Var | Default | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | `''` | Empty → Stripe endpoints return 503 |
| `STRIPE_WEBHOOK_SECRET` | `''` | Required when STRIPE_SECRET_KEY is set |
| `STRIPE_PRICE_ID` | `''` | Recurring subscription price ID |
| `BILLING_SUCCESS_URL` | `https://app.tinadiet.com/?upgraded=1` | Redirect after Stripe checkout success |
| `BILLING_CANCEL_URL` | `https://app.tinadiet.com/?upgrade_canceled=1` | Redirect after cancellation |

### Omise (PRIMARY payment provider)

| Var | Default | Description |
|---|---|---|
| `OMISE_PUBLIC_KEY` | `''` | TEST: `pkey_test_*`, LIVE: `pkey_*` |
| `OMISE_SECRET_KEY` | `''` | Empty → Omise endpoints 503. TEST: `skey_test_*` |
| `OMISE_API_BASE_URL` | `https://api.omise.co` | API base — change only if Omise mirrors |
| `OMISE_API_VERSION` | `2019-05-29` | API version header sent on every request |
| `OMISE_WEBHOOK_SECRET` | `''` | Base64-encoded HMAC secret. Empty → webhook accept-all (DEV ONLY) |
| `PAYMENT_AMOUNT_THB` | `150` | Price per grant period |
| `PAYMENT_GRANT_DAYS` | `30` | Days of premium per successful payment |
| `PAYMENT_RETURN_URL` | `https://app.tinadiet.com/premium?omise_return=1` | TrueMoney redirect-back URL |

## LIFF (`projects/liff/.env`)

LIFF reads only `VITE_*` prefixed vars at BUILD time. Vite embeds them
directly in the bundle.

| Var | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend URL — `https://api.tinadiet.com` in prod, `http://localhost:3000` in dev |
| `VITE_LIFF_ID` | LIFF channel ID from LINE Developers Console |

In Cloudflare Workers Builds (production builds), also set:
- `NODE_VERSION=22` — required since wrangler 4

## Docs (`projects/docs/`)

This documentation site has no env vars currently. Astro config is
static. If we later need preview-vs-prod branching, add `ASTRO_*` vars.

In Cloudflare Pages dashboard:
- `NODE_VERSION=22` — for Astro 5 build

## Secrets file (outside repo)

The maintainer keeps an outside-repo file with all current production
secrets:

```
c:\Users\carvi\AIchatbot\SECRETS_TINADIET_LOCAL.md
```

This file is NOT in any git repo by design. It includes LINE keys,
OpenAI key, Omise keys, Stripe (when active), JWT secret, Cloudflare 2FA
recovery codes, etc.

For collaborators, the project owner provisions a similar file with the
appropriate subset of credentials.

## Adding a new env var

1. Decide which project owns it (backend / liff / docs)
2. Add to that project's `.env.example` with comment + sensible default
3. If backend: add to `config/env.ts` with type + default
4. Document on this page under the appropriate section
5. Set the actual value in production (Railway for backend, Cloudflare
   build settings for liff/docs)

Don't add env vars to multiple projects unless the value is genuinely
shared (e.g. a feature flag affecting both backend and LIFF logic — even
then, separate names).
