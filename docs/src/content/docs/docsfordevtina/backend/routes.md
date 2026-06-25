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
middleware) except `/auth/exchange` and `/gifts/claim/:token` (GET, public
preview).

| Endpoint | Method | Purpose |
|---|---|---|
| `/auth/exchange` | POST | Exchange LIFF access token for backend session JWT |
| `/users/me` | GET, PATCH | Get / update user profile (computes goals on PATCH) |
| `/food-logs` | GET, POST, PATCH/:id, DELETE/:id | Food log CRUD (today only) |
| `/weight-logs` | GET, POST | Weight tracking |
| `/history` | GET | Per-date summary with 30d free / 365d premium gating (`?date=YYYY-MM-DD`) |
| `/chat/messages` | GET, POST | Consultation Q&A (premium-gated) |
| `/billing/status` | GET | Plan + payment provider config + latest payment |
| `/billing/checkout` | POST | Stripe checkout session (returns 503 when dormant) |
| `/billing/cancel` | POST | Stripe cancel-at-period-end (returns 404 if no subscription) |
| `/billing/omise/charge` | POST | Create Omise charge (returns 503 when dormant) |
| `/billing/omise/charge/:id` | GET | Polling endpoint (auto-syncs with Omise if pending) |
| `/wallet` | GET | Credit balance + recent ledger entries |
| `/wallet/history` | GET | Paginated ledger history |
| `/topup/manual/start` | POST | Begin manual PromptPay top-up (returns QR data URL) |
| `/topup/manual/:id/upload-slip` | POST | Multipart upload of payment slip image |
| `/topup/manual/:id/cancel` | POST | Owner self-cancel awaiting_slip top-up |
| `/topup/manual/current` | GET | Resume an in-progress awaiting_slip top-up |
| `/topup/submissions` | GET | User's own top-up submission list |
| `/topup/config` | GET | min / max / presets (driven by system_settings) |
| `/premium/bundles` | GET | Catalog: 7d / 1mo / 3mo / 6mo / 12mo with prices + originals |
| `/premium/redeem` | POST | Spend credit to grant premium days (stacking) |
| `/themes` | GET | Catalog + owned + active theme |
| `/themes/:slug/purchase` | POST | Buy theme with credit |
| `/themes/:slug/activate` | POST | Switch active theme (must be owned) |
| `/gifts` | POST | Create gift (premium bundle or theme) → returns claim_token |
| `/gifts/sent` | GET | List gifts user has sent (any status) |
| `/gifts/received` | GET | List gifts user has received |
| `/gifts/claim/:token` | GET | **Public preview** (no auth) — gift type, sender, message |
| `/gifts/claim/:token` | POST | Authenticated claim (apply entitlement to caller) |
| `/gifts/:id/cancel` | POST | Sender-only self-cancel a pending gift |
| `/account/export` | POST | PDPA data export — returns full JSON bundle |
| `/account/delete` | POST | PDPA account deletion (requires `confirm: 'DELETE'`) |

### `/api/v1/admin/*` operator + superadmin routes

Mounted under `/api/v1/admin/`, gated by `requireAdmin` (any admin) or
`requireSuperadmin` (superadmin only) middleware. JWT audience must be
`admin` (separate from user JWT).

| Endpoint | Method | Role | Purpose |
|---|---|---|---|
| `/auth/login` | POST | public | Email + password → admin JWT |
| `/auth/me` | GET | admin | Current admin info |
| `/auth/change-password` | POST | admin | Self-rotate password |
| `/payments/pending` | GET | admin | FIFO oldest-first list of awaiting-review top-ups |
| `/payments/history` | GET | admin | Status-filtered list with pagination |
| `/payments/:id` | GET | admin | Full submission detail |
| `/payments/:id/slip` | GET | admin | Authenticated blob fetch of slip image |
| `/payments/:id/approve` | POST | admin | Approve + grant credit (escalates if high-value) |
| `/payments/:id/reject` | POST | admin | Reject with reason (may flag user) |
| `/payments/:id/revoke` | POST | superadmin | Compensating ledger entry |
| `/users` | GET | admin | Search + flag filter |
| `/users/:id` | GET | admin | Detail + ledger view |
| `/users/:id/adjust-credit` | POST | superadmin | Manual credit grant (positive or negative) |
| `/users/:id/clear-warnings` | POST | superadmin | Reset abuse_warning_count |
| `/users/:id/block` | POST | superadmin | Manual block |
| `/users/:id/unblock` | POST | superadmin | Manual unblock |
| `/settings` | GET, PUT | admin (GET) / superadmin (PUT) | Manage `system_settings` |
| `/operators` | GET, POST, PATCH/:id, DELETE/:id | superadmin | Operator CRUD |
| `/gifts` | GET | admin | List gifts (status filter) |
| `/gifts/:id` | GET | admin | Gift detail |
| `/gifts/:id/revoke` | POST | superadmin | Revoke (refund sender + unwind recipient) |

## `/webhook/line`

`POST /webhook/line` — LINE Messaging API webhook.

1. Verify `X-Line-Signature` header against request body using
   `LINE_CHANNEL_SECRET`
2. Upsert user from `lineUserId`
3. Pre-classification gates (these run BEFORE intent classification —
   they short-circuit when active):
   - **Support mode active** (`isInSupportMode(user)`): any message
     replies with generic ACK; exit keywords (`exit`/`ออก`/`ยกเลิก`/...)
     clear mode. No AI calls, no DB writes beyond the user record.
   - **Support trigger** (text matches `^support$` case-insensitive):
     `setSupportMode(user, now+30min)` + reply auto-message asking for
     description. Team Tina handles via OA Manager Chats tab.
4. Profile gate (`isProfileComplete(user)`): if false, reply
   `profileGateText` (asks user to open Dashboard via Rich Menu).
5. Parse events → dispatch by intent:
   - `intent.classify(event)` returns one of: `weight_log`, `show_logs`,
     `consult_question`, `greeting`, `attempt_parse`, `image`
   - Greeting → static reply
   - weight_log regex match → save + reply with target distance
   - show_logs (วันนี้/logs/today/etc.) → numbered list reply
   - consult_question → `runConsultation()` (premium-gated)
   - attempt_parse → `parseTextToFoodLog()` → save → reply
   - image → `parseImageToFoodLog()` → save → reply (premium-gated)
6. Reply via LINE Reply API using `replyToken`

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
| `/internal/jobs/renewal-reminders` | POST | Trigger renewal reminder push (3d/1d/day-of buckets) |
| `/internal/jobs/expire-gifts` | POST | Trigger expire pending gifts past 7-day claim window |

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
'https://admin.tinadiet.com',                    // production admin dashboard
'https://liff.line.me',                          // LINE's LIFF host
'http://localhost:5173',                         // dev LIFF Vite
'http://localhost:5174',                         // dev admin Vite
/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,    // dev tunnel
```

Allowed methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`. The PUT entry
is critical for admin Settings + operator update endpoints; omitting it
causes silent "Failed to fetch" errors due to preflight rejection.

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
