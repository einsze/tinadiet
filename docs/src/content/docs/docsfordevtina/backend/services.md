---
title: Services
description: How services coordinate domain logic, repositories, and external APIs.
sidebar:
  order: 3
---

Services live in `backend/src/services/`. They're the "use-case orchestrator"
layer between routes (HTTP adapters) and repositories (DB access). External
API clients (OpenAI, Omise, Stripe) also live here.

## What belongs in a service

- Coordinating multiple repositories in one logical operation
- Calling external APIs (OpenAI, LINE, Omise, Stripe)
- Computing derived values that need both DB state and API responses
- Throwing custom error types that routes can catch

## What does NOT belong

- Pure functions with no I/O → put in `domain/`
- Single DB query → just use the repository directly from route
- HTTP request/response munging → keep in route handler

## Service catalog

### `food_parser.ts`

Parses food descriptions to structured `food_logs`. Two entry points:

```ts
parseTextToFoodLog(text: string) → ParseResult
parseImageToFoodLog(imageBase64: string) → ParseResult

type ParseResult =
  | { kind: 'items'; items: ParsedItem[] }
  | { kind: 'needs_clarification'; question_th: string }
  | { kind: 'not_food'; reason_th: string };
```

- Uses `gpt-4o-mini` for text, `gpt-4o` for vision (low detail for cost)
- Strict JSON schema in OpenAI request enforces structured output
- SYSTEM_PROMPT enforces Thai output, female register, clarification
  rules ("ข้าวอะไรคะ? ข้าวเปล่า ข้าวผัด หรือข้าวมันไก่?")
- Multi-item parses ("ผัดกะเพรา + ไข่ดาว + น้ำส้ม") return array; each
  becomes a separate `food_logs` row

### `coach.ts`

Generates proactive meal suggestions after each food log.

```ts
generateMealSuggestion(ctx: CoachContext) → Suggestion
```

Context includes: time of day, today's totals so far, daily goals, recent
logs. SYSTEM_PROMPT enforces contextual rules (after heavy main → light
drink, time-of-day appropriate, Thai cuisine first).

Triggered from two places:
1. PATCH `/users/me` first-time profile setup → welcome push with greeting + first suggestion
2. `food_parser` confirmation → suggestion appended to confirmation reply (saves push quota)

### `consultation.ts`

Q&A for nutrition + light exercise questions, premium-gated.

```ts
runConsultation(user: User, question: string, opts?) → ConsultationResult

type ConsultationResult =
  | { kind: 'answered'; user_message, assistant_message, topic, refused, quota }
  | { kind: 'quota_exceeded'; questions_today, limit };
```

- Quota: `CONSULT_DAILY_LIMIT=20` per user per day
- Multi-turn context: last 10 messages within last 120 minutes
- Topic enum: `nutrition | exercise_light | meal_planning | general_wellness | out_of_scope`
- Refusal style: ONE short Thai sentence redirecting
- Same orchestrator called from both LINE webhook AND `POST /api/v1/chat/messages`

### `omise.ts`

Omise payment integration. See [Payments overview](/docsfordevtina/payments/overview/).

```ts
createOmiseCharge(user, method) → CreateChargeResult
retrieveOmiseCharge(chargeId) → OmiseCharge
syncChargeFromOmise(chargeId) → Payment | undefined
handleOmiseEvent(event) → OmiseWebhookResult
parseOmiseWebhookEvent(rawBody) → OmiseEvent
verifyOmiseSignature(rawBody, sigHeader, tsHeader) → boolean
```

- Thin HTTP client (native `fetch`, no SDK)
- HMAC-SHA256 webhook signature verify (base64-decoded secret)
- Grant stacking via `computeGrantWindow(user, days, now)`
- Idempotent webhook (early return if `payment.status === 'successful'`)

### `stripe.ts`

Stripe integration — **dormant** since Sprint 6 payment pivot. Code
preserved for future use (e.g. if SaaS subscription model added later).

When `STRIPE_SECRET_KEY` is empty, all functions throw or routes return
`503 STRIPE_NOT_CONFIGURED`. LIFF hides Stripe-related UI when
`/billing/status` returns `stripe_configured: false`.

### `credit.ts`

Single source of truth for credit balance mutations. See
[invariant #13](/docsfordevtina/architecture/key-invariants/#13-credit-mutations-only-via-applycreditmutation).

```ts
applyCreditMutation({
  userId, amountSatang, sourceType, sourceRefId?, adminUserId?, note?
}) → { ledgerId, newBalanceSatang }
```

Atomic SQLite transaction = ledger row insert + user balance update.
Throws on negative balance overflow. NEVER directly UPDATE
`users.credit_balance_satang` anywhere else.

### `manual_payment.ts`

Orchestrator for the manual PromptPay top-up lifecycle:

```ts
startManualTopup(user, amountSatang) → ManualPayment
attachSlip(manualPaymentId, file) → ManualPayment
approveManualPayment(adminId, id, { actualAmountSatang, flagAbuse }) → ApproveResult
rejectManualPayment(adminId, id, reason, flagAbuse) → ManualPayment
revokeManualPayment(adminId, id, reason) → RevokeResult
cancelOwnTopup(user, id) → boolean
```

- Validates user not blocked + no existing `awaiting_slip` per user
- Escalates to `flagged_review` when `actualAmount ≥ high_value_threshold_satang`
  and the calling admin isn't superadmin
- Approve flow calls `applyCreditMutation` + (optionally) `flagUserForAbuse`

### `premium_redemption.ts`

Convert credit → premium days via bundle redeem.

```ts
redeemPremiumBundle(user, bundle: 1 | 3 | 6 | 12 | '7d') → { newExpiry, balance }
computeNewExpiry(user, bundle, now) → string  // stacking math
getAllBundlePrices() → Record<bundle, number>
getAllBundleOriginalPrices() → Record<bundle, number>  // for discount badge
```

- Stacking via `max(now, current_expiry) + duration`
- `'7d'` bundle special-cases to `addDaysIso(base, 7)`
- Numeric bundles use `addMonthsIso`

### `gifts.ts`

Peer-to-peer gift system. Massive module — handles creation, claim,
cancel, refund, revoke, plus all 6 push notifications.

```ts
createGift({ sender, recipientLineUserId?, giftType, payload, message }) → Gift
previewGiftClaim(token) → GiftPreview  // public, no auth
claimGift(claimer, token) → { entitlementApplied }
cancelGift(sender, giftId) → Gift
expirePendingGifts() → { expired }  // cron-called
revokeGift(adminId, giftId, reason) → RevokeResult
notifyGiftClaimed(gift, recipient) / notifyGiftCanceled(gift) /
notifyGiftRefused(gift) / notifyGiftExpired(gift) /
notifyGiftRevokedToSender(gift) / notifyGiftRevokedToRecipient(gift)
```

- Claim token: 22-char base64url, 128-bit entropy
  (`crypto.randomBytes(16).toString('base64url')`)
- Claim URL is the LIFF deep-link form (`liff.line.me/<id>/claim/<token>`),
  NOT plain `app.tinadiet.com` ([invariant #15](/docsfordevtina/architecture/key-invariants/#15-liff-deep-links-for-in-line-urls))
- `applied_premium_ms_added` + `applied_theme_slug` captured at claim
  time so revoke can unwind deterministically

### `promptpay_qr.ts`

Server-renders a PromptPay EMVCo QR code as a data URL (PNG). Uses
`promptpay-qr` (payload builder) + `qrcode` (PNG renderer).

```ts
renderPromptPayQr({ promptpayId, amountSatang, receiverName }) → { dataUrl, payload }
```

Configured via admin `system_settings.promptpay_id` (mobile / national
ID) + `promptpay_id_type` + `promptpay_receiver_name`. Returns `503`
shaped error if not configured.

### `slip_storage.ts`

Multer file storage for top-up slip uploads. Stores files at
`SLIP_STORAGE_DIR=/data/slips/<uuid>.<ext>`. Max 5 MB, mime allowlist
JPG / PNG / WEBP. The file path goes in `manual_payments.slip_file_path`
column; reading uses authenticated `/admin/payments/:id/slip` endpoint.

### `abuse_flag.ts`

Tiered abuse-warning logic (Level B from the original spec):

- 1 warning → `abuse_warning_count++` (no other action)
- 3 warnings → future submissions auto-route to superadmin review
- 5 warnings → user auto-blocked (`is_blocked=1`), can no longer top up

Each operator-flagged submission inserts a `user_flags` audit row. Clear
warnings via superadmin clears all flags + resets count.

### `admin_auth.ts`

bcrypt password verify + 8-hour JWT issuance with `audience='admin'`.
Falls back to `SESSION_JWT_SECRET` if `ADMIN_JWT_SECRET` not set
(acceptable for launch but better to set independently in production).

## OpenAI client convention

A shared client lives in `backend/src/ai/client.ts`:

```ts
import OpenAI from 'openai';
import { env } from '../config/env.js';

let _client: OpenAI | null = null;

export const openaiClient = (): OpenAI => {
  if (_client !== null) return _client;
  if (env.OPENAI_API_KEY.length === 0) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  _client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: env.OPENAI_TIMEOUT_MS,
  });
  return _client;
};
```

Lazy init (same pattern as repos and stripe). Allows backend to boot
without OPENAI_API_KEY set; the first call to a service that uses OpenAI
will throw.

## When to add a new service

- Logic touches more than one repository
- Logic calls an external API
- Logic is reused across routes + jobs + webhook handlers

Otherwise, keep it inline in the route or push into `domain/`.
