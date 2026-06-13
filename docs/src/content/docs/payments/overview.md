---
title: Overview
description: Payment provider strategy, manual-renewal model, grant stacking.
sidebar:
  order: 1
---

Tina Diet's premium tier is **150 THB for 30 days**, paid via **Omise**
PromptPay QR or TrueMoney Wallet. **No auto-charge** — users pay each
period explicitly, and unspent days carry over via grant stacking.

## Why this model?

In Thailand:
- **PromptPay** is universal (every bank's mobile app supports QR scan)
- **TrueMoney Wallet** is the second-most-popular e-wallet
- **Recurring auto-charge** is much rarer than in the West; Thai users are
  accustomed to one-time purchases and explicit renewals
- Stripe-style auto-renewing subscriptions don't fit local payment habits

So we use Omise's one-time **Charges API** (not their Recurring Schedule
API), and treat each successful charge as a 30-day grant.

## Grant stacking

When a payment succeeds, `services/omise.ts` `computeGrantWindow()`
computes:

```ts
const stackStart = currentExpiryMs > now.getTime() ? currentExpiryMs : nowMs;
const grantEnds = stackStart + grantDays * 24 * 60 * 60 * 1000;
```

So:
- If user pays while expired (or never paid): new expiry = `now + 30 days`
- If user pays while still premium: new expiry = `current_expiry + 30 days`

The user **never loses days**. They can buy two months ahead and the
expiry pushes 60 days from current.

LIFF mirrors this math in `lib/premium.ts` `computeProjectedExpiry()` so the
"วันหมดอายุใหม่จะเป็น 11 ส.ค. 2569" preview shows the correct date BEFORE
the user pays.

## Payment provider strategy

| Provider | Status | Reason |
|---|---|---|
| **Omise** | ✅ Active | Native Thailand provider, lower fee (~3.65% vs Stripe's 4.65%), supports PromptPay + TrueMoney natively |
| **Stripe** | 💤 Dormant | Code preserved (services + routes), env empty → graceful 503. Worth keeping for future SaaS subscription model |

The `subscriptions` table is Stripe-only; the `payments` table is
Omise-only. This keeps semantics clean: Stripe = ongoing relationship,
Omise = discrete transactions.

## Methods supported

| Method | UX | Backend `source.type` | Auto-renew? |
|---|---|---|---|
| **PromptPay QR** | In-LIFF modal with QR + countdown + polling | `promptpay` | ❌ Manual each time |
| **TrueMoney Wallet** | Redirect to Omise authorize page → TrueMoney app deep-link | `truemoney_jumpapp` | ❌ Manual each time |

**NOT supported** (could be added):
- Credit/Debit Card (would need Omise's Schedule API for true auto-renew —
  scoped out of v1)
- Internet banking (less popular than PromptPay)
- Rabbit LINE Pay (deferred — overlap with LINE ecosystem might confuse)

## Idempotency

Payments table has UNIQUE `(provider, provider_charge_id)`. Webhook handler
in `services/omise.ts` `handleOmiseEvent()` checks
`payment.status === 'successful'` and early-returns if already processed.

Same event delivered twice (Omise retries on non-2xx, sometimes delivers
duplicates) is safe — second delivery is a no-op.

## Webhook flow

```
PromptPay scan / TrueMoney auth
  │
  ▼
Omise records payment
  │
  ▼
Omise fires charge.complete webhook
  │
  ▼
POST /webhooks/omise on backend
  │
  ├──→ verifyOmiseSignature() against Omise-Signature header
  │     (HMAC-SHA256 of `${timestamp}.${rawBody}` using base64-decoded secret)
  │
  ├──→ parseOmiseWebhookEvent() validates shape
  │
  ├──→ Respond 200 immediately
  │
  └──→ Async handleOmiseEvent():
        - Find payment row by charge_id
        - If status already 'successful', return (idempotent)
        - Otherwise: mark successful, compute grant window, applyPremium on user
```

See [Webhook signature](/documentation/payments/webhook-signature/) for the
HMAC details (and the lesson learned from initially assuming Basic Auth).

## Polling fallback

Webhooks can be delayed or missed. LIFF polls
`GET /api/v1/billing/omise/charge/:id` every 2 seconds while the PromptPay
modal is open. If still `pending` AND Omise is configured, the route also
calls `syncChargeFromOmise()` which retrieves the current state from Omise
directly and applies grant if successful.

This means even if the webhook never arrives, the user still gets premium
extended within a few seconds of the poll detecting success at Omise.

## Going live

TEST mode (currently active) lets us fully simulate flows without real
money:
- TEST `pkey_test_*` + `skey_test_*` keys from Omise dashboard
- PromptPay QR rendered with "TEST MODE" overlay
- TrueMoney redirects to Omise's authorize SIMULATOR page (3 buttons:
  Successful / Failed / Pending)
- Webhooks fire normally

LIVE mode requires:
1. Omise business verification approved (Thai docs: ภพ.20, DBD, bank, ID)
2. PromptPay + TrueMoney methods enabled in Omise dashboard
3. TrueMoney provider approval (separate, +7-14 days lag possible)
4. LIVE API keys (`pkey_*` + `skey_*` without `_test_`) set in Railway env
5. LIVE webhook secret in Railway env

**No code change** between TEST and LIVE — just env values.

See [Omise integration](/documentation/payments/omise/) for the full
integration details.

## Cost model

| Item | Cost |
|---|---|
| Pricing | 150 THB / 30 days |
| Omise fee | ~3.65% (Thai cards/PromptPay/TrueMoney) |
| Net per payment | ~145 THB |
| OpenAI marginal | ~$0.004/user/day max if cap (20 questions × $0.0002) |
| Net margin | ~140 THB / user / month at full premium quota use |

When TrueMoney has higher fees (e.g. specific bank), check with Omise rep
for exact rates.

## Future ideas

- **Annual plan** with discount — would need different `grant_days` per
  product
- **PromptPay X / TrueMoney Pro tiers** if usage data justifies
- **Recurring auto-charge via card** if user demand emerges — would
  re-enable Stripe (since Omise's Schedule API has Thai-market quirks)
