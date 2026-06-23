---
title: Routes
description: HTTP routing structure and mount order.
sidebar:
  order: 4
---

The backend exposes four categories of HTTP routes.

## Routes overview

| Prefix | Auth | Body parser | Caller |
|---|---|---|---|
| `/healthz` | none | none | uptime monitors |
| `/webhook/line` | LINE signature | `express.json` (post-verify) | LINE Messaging API |
| `/webhooks/stripe` | Stripe signature | `express.raw` | Stripe (dormant) |
| `/webhooks/omise` | Omise HMAC | `express.raw` | Omise |
| `/api/v1/*` | session JWT | `express.json` (global) | LIFF |
| `/internal/jobs/*` | `x-jobs-secret` header | `express.json` (global) | cron / manual |

## Mount order (matters!)

In `backend/src/index.ts`:

```ts
app.disable('x-powered-by');
app.set('trust proxy', 1);

// 1. Webhooks BEFORE express.json — they need raw body for sig verify
app.use('/webhook', lineWebhookRouter);
app.use('/webhooks', stripeWebhookRouter);
app.use('/webhooks', omiseWebhookRouter);

// 2. CORS only for /api/v1
app.use('/api/v1', cors({ /* allowlist */ }));

// 3. Global JSON body parser
app.use(express.json({ limit: '256kb' }));

// 4. /api/v1 and /internal use parsed JSON
app.use('/api/v1', apiV1Router);
app.use('/internal/jobs', internalJobsRouter);

// 5. Health + root
app.get('/healthz', ...);
app.get('/', ...);

// 6. 404 fallback
app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND' } }));
```

## `/api/v1/*` LIFF-facing routes

All require `Authorization: Bearer <session_jwt>` (via `requireAuth`
middleware) except `/auth/exchange`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/auth/exchange` | POST | Exchange LIFF access token for backend session JWT |
| `/users/me` | GET, PATCH | Get / update user profile (computes goals on PATCH) |
| `/food-logs` | GET, POST, PATCH/:id, DELETE/:id | Food log CRUD |
| `/weight-logs` | GET, POST | Weight tracking |
| `/chat/messages` | GET, POST | Consultation Q&A (premium-gated) |
| `/billing/status` | GET | Plan + payment provider config + latest payment |
| `/billing/checkout` | POST | Stripe checkout session (returns 503 when dormant) |
| `/billing/cancel` | POST | Stripe cancel-at-period-end (returns 404 if no subscription) |
| `/billing/omise/charge` | POST | Create Omise charge (PromptPay or TrueMoney) |
| `/billing/omise/charge/:id` | GET | Polling endpoint (auto-syncs with Omise if pending) |
| `/account/export` | POST | PDPA data export — returns full JSON bundle |
| `/account/delete` | POST | PDPA account deletion (requires `confirm: 'DELETE'`) |

## `/webhook/line`

`POST /webhook/line` — LINE Messaging API webhook.

1. Verify `X-Line-Signature` header against request body using
   `LINE_CHANNEL_SECRET`
2. Parse events → dispatch by intent:
   - `intent.classify(event)` returns one of: `weight_log`, `show_logs`,
     `consult_question`, `greeting`, `attempt_parse`, `image`
   - Greeting → static reply
   - weight_log regex match → save + reply with target distance
   - show_logs (วันนี้/logs/today/etc.) → numbered list reply
   - consult_question → `runConsultation()` (premium-gated)
   - attempt_parse → `parseTextToFoodLog()` → save → reply
   - image → `parseImageToFoodLog()` → save → reply (premium-gated)
3. Reply via LINE Reply API using `replyToken`

## `/webhooks/stripe` (dormant)

`POST /webhooks/stripe` — Stripe webhook. Verifies via Stripe SDK
`webhooks.constructEvent`. Handles `checkout.session.completed`,
`customer.subscription.*`, `invoice.payment_failed`. Updates
`subscriptions` table and reconciles `users.plan` + `premium_expires_at`.

Currently inactive (env empty). Code preserved for future re-enablement.

## `/webhooks/omise`

`POST /webhooks/omise` — Omise webhook. Verifies HMAC-SHA256 signature
against `Omise-Signature` + `Omise-Signature-Timestamp` headers using
base64-decoded `OMISE_WEBHOOK_SECRET`. Handles `charge.*` events.

**Crucial**: uses `express.raw({type: 'application/json'})` to preserve
bytes for HMAC. See [Payments — Webhook signature](/docsfordevtina/payments/webhook-signature/).

## `/internal/jobs/*`

Manual triggers for cron jobs. Guarded by `x-jobs-secret` header matching
`JOBS_TRIGGER_SECRET` env.

| Endpoint | Method | Purpose |
|---|---|---|
| `/internal/jobs/daily-summary` | POST | Trigger daily summary (supports `?dry_run=true`) |
| `/internal/jobs/weekly-summary` | POST | Trigger weekly summary |
| `/internal/jobs/expire-premium` | POST | Trigger expire premium sweep |

Useful for testing without waiting for the cron schedule.

## `/healthz`

`GET /healthz` — public health check. Returns:

```json
{
  "status": "ok",
  "service": "tinadiet-backend",
  "env": "production",
  "commit": "197f3dd",
  "started_at": "2026-06-13T00:44:38Z",
  "uptime_seconds": 87
}
```

Used by uptime monitors and to verify deploys. The `commit` field is
populated from `RAILWAY_GIT_COMMIT_SHA` env (auto-set by Railway).

## CORS

Only `/api/v1/*` has CORS enabled. Allowlist:

```ts
'https://app.tinadiet.com',                     // production LIFF
'https://liff.line.me',                          // LINE's LIFF host
'http://localhost:5173',                         // dev Vite
/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,    // dev tunnel
```

Webhook endpoints don't need CORS (called by external services
directly, not browser-initiated).

## Adding a new route

1. Create file under `backend/src/routes/api/<name>.ts` (or appropriate
   subfolder)
2. Export an Express `Router` instance
3. Use `requireAuth` middleware for authenticated endpoints
4. Use Zod to validate request body
5. Mount in `routes/api/index.ts` (or relevant parent)
6. Add to this docs page

Example:

```ts
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

const bodySchema = z.object({
  weight_kg: z.number().min(20).max(400),
});

router.post('/', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
    return;
  }

  const parse = bodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: 'BAD_REQUEST' } });
    return;
  }

  // ... call service, respond
});

export default router;
```
