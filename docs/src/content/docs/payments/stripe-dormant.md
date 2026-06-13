---
title: Stripe (Dormant)
description: Why Stripe code is preserved but inactive, and how to reactivate.
sidebar:
  order: 4
---

The repo includes complete Stripe integration code that is currently
**inactive**. Env vars are empty → backend returns `503 STRIPE_NOT_CONFIGURED`
on Stripe-related endpoints, LIFF hides Stripe-related UI via the
`stripe_configured: false` flag in `/billing/status`.

## Why kept?

1. **Future-proofing**: If we later add an annual SaaS subscription with
   auto-renew, Stripe is the right tool (Thai PromptPay/TrueMoney are
   inherently one-time)
2. **International users**: If Tina Diet expands beyond Thailand, Stripe
   supports cards globally
3. **Comparison reference**: The HMAC signature pattern in `stripe.ts`
   served as a model when we built Omise's similar (but different) sig verify

The code lives in:
- `backend/src/services/stripe.ts`
- `backend/src/routes/webhook/stripe.ts`
- `backend/src/routes/api/billing.ts` — `/checkout` + `/cancel` endpoints
- `backend/src/repositories/subscriptions.ts`
- DB table `subscriptions` (created in migration `0006`)

## What it does (when active)

Standard Stripe subscription flow:

1. User clicks "Subscribe" in LIFF → POST `/api/v1/billing/checkout`
2. Backend creates Stripe Checkout Session (mode: subscription) with
   recurring price `STRIPE_PRICE_ID`
3. Returns session URL → LIFF `window.location.href = url`
4. User completes payment on Stripe-hosted page
5. Stripe redirects to `BILLING_SUCCESS_URL` (LIFF)
6. Webhook `checkout.session.completed` arrives → backend looks up
   subscription, upserts to `subscriptions` table, applies premium to user
7. Subsequent webhooks (`customer.subscription.updated`, etc.) maintain
   state in sync
8. To cancel: POST `/api/v1/billing/cancel` → sets `cancel_at_period_end`
   = true; user keeps premium until period end

## Reactivating

To turn Stripe back on:

### 1. Provision in Stripe dashboard

- Activate THB on Stripe account
- Create Product **"Tina Diet Premium"**
- Create recurring Price 150 THB / month (copy the `price_xxx` ID)
- In Webhooks, add endpoint:
  ```
  https://api.tinadiet.com/webhooks/stripe
  ```
  Subscribe to events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.paused`
  - `customer.subscription.resumed`
  - `invoice.payment_failed`
  Copy the signing secret.

### 2. Set Railway env

```bash
STRIPE_SECRET_KEY=sk_test_...     # or sk_... for LIVE
STRIPE_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Restart backend

Railway auto-redeploys on env change. Verify:
```bash
curl https://api.tinadiet.com/api/v1/billing/status -H "Authorization: ..."
# stripe_configured: true
```

### 4. (LIFF) re-enable upgrade button

Currently `PremiumSection` hides the Stripe upgrade button when
`stripe_configured: false`. After backend reports `true`, the button
auto-appears.

### 5. Decide coexistence

If you want **Stripe alongside Omise**, both can be active simultaneously:
- LIFF would need UI to let users choose provider
- Webhook routes are independent (separate paths, separate secrets)
- `subscriptions` (Stripe) and `payments` (Omise) tables are independent

Or, if Stripe replaces Omise:
- Empty Omise env vars to disable
- Hide Omise method picker

## Code quality

The Stripe code follows the same conventions as Omise:
- Lazy client init (`stripeClient()` getter)
- Custom error class `StripeServiceError`
- Idempotent webhook handler
- Graceful 503 when not configured

Difference: Stripe SDK (`stripe` npm package) is used because Stripe's API
has many endpoints and complex types; the SDK pays for itself. Omise has
a small surface (we only use 2 endpoints) so we wrote a thin HTTP client.

## When NOT to reactivate

- If 150 THB / 30 days manual renewal works fine in production → don't
  re-add complexity
- If user feedback says "I want auto-renew" but few actually convert →
  not worth the support burden
- If accounting/refund flows differ between providers → unifying them is
  ongoing cost

In other words: Stripe is here because removing it would lose value, not
because it's strictly needed today.
