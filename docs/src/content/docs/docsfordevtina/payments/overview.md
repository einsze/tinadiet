---
title: Overview
description: Manual top-up + credit ledger + bundle redemption. Operator review workflow. Omise dormant pending KYC.
sidebar:
  order: 1
---

Tina Diet's monetization is **credit-based**. Users top up credit
via manual PromptPay transfer (operator-reviewed), then **redeem**
credit for premium bundles (7 days, 1, 3, 6, or 12 months).

End-to-end **validated in production 2026-06-25**: real Thai banking app
PromptPay scan → slip upload → operator approval → credit grant →
bundle redeem. The system is launch-ready and accepting real paying
users.

This is a deliberate pivot from the original direct-charge Omise model
because Omise business verification takes ~1 month and we needed a
launch-ready payment path that uses the client's existing personal
PromptPay account (later promotable to a business Tax ID).

## High-level flow

```
USER
─────
1. Open LIFF → /premium → tap "Top up credit"
2. Choose method: Manual PromptPay (active) / Omise (Coming Soon)
3. Pick amount: 49 / 150 / 450 / 900 / 1800 THB (aligned to bundle prices)
   or custom (min 49 THB, max 5000 THB by default)
4. Backend generates PromptPay QR with amount baked in (server-side)
5. Scan QR in any Thai bank app, transfer
6. Upload slip back to LIFF
7. See status "รอตรวจสอบ (1–24 ชั่วโมง)"

OPERATOR
─────────
8. Login to admin.tinadiet.com
9. /payments/pending shows oldest submission first (FIFO queue)
10. Open submission → view slip image fullscreen
11. Cross-check the slip vs. their own bank statement
12. Enter ACTUAL amount from slip (operator-editable)
13. Approve → user gets credit = actual amount
    Reject → user gets push notification with reason, can re-submit

USER REDEEMS
─────────────
14. Credit balance updated in /premium marketplace
15. Tap "Premium 1 mo (150 credit)" / 3 / 6 / 12
16. Credit deducted, premium_expires_at extended (stacking)
```

## Why credit-first?

| Problem (old direct-charge model) | Credit-system solution |
|---|---|
| User transfers 100 THB instead of 150 — refund? | Operator enters 100 → user gets 100 credit, no refund needed |
| User transfers 200 THB by mistake | Operator enters 200 → user gets 200 credit (bonus 50 stays in wallet) |
| What if Omise verification takes weeks? | Manual flow is independent, launches immediately |
| Future themes / day passes need pricing logic | Credit is generic — anything can be priced in credit |
| Stripe vs Omise — multiple ledgers | One ledger, multiple providers feed in (future) |

The single ledger ([`credit_ledger`](/docsfordevtina/architecture/data-model/))
becomes the source of truth for all monetization. Providers (manual PromptPay
now, Omise later) just feed credit *into* the ledger; downstream
spend (premium, future themes, etc.) draws *from* it.

## Conversion math

- **1 credit = 1 THB** (1:1, no bonus tiering)
- Credit stored internally as satang (1 THB = 100 satang) to avoid
  floating-point money math
- Default premium bundle prices (configurable in admin `/settings`):

| Bundle | Credit |
|---|---|
| 7 days   | 49 |
| 1 month  | 150 |
| 3 months | 450 |
| 6 months | 900 |
| 12 months | 1800 |

Flat pricing (no bulk discount) by default — admin can change to add a
discount curve any time without code change.

The 7-day bundle (49 credit ≈ 49 THB) acts as a low-friction trial tier;
its price equals roughly one daily coffee in Thailand. The webhook
premium gates (when free users hit a Premium-only feature in LINE chat)
explicitly pitch this 49฿/7-day option with the "average 7฿/day" hook.

For the 49 THB minimum to actually be accepted by the backend, the admin
`topup_min_satang` setting must be lowered from its default `5000`
(50 THB) to `4900` (49 THB). This is configured in production.

**Original-price promo display:** admin can set `original_price_X_credit`
higher than the current `price_X_credit` and the LIFF marketplace will
render a strikethrough on the original + a `−X% OFF` ribbon. Set 0 to
hide. Affects display only — actual charge stays at `price_X_credit`.

## Provider status

| Provider | Status | Role |
|---|---|---|
| **Manual PromptPay** | ✅ Active | Primary cash inflow path. Operator-reviewed. |
| **Omise PromptPay / TrueMoney** | 💤 Coming Soon | UI displayed but disabled. Pending Thai business verification (KYC ~1 month). Post-KYC will be refactored to feed credit ledger (same model as manual). |
| **Stripe** | 💤 Dormant | Code preserved, env empty → 503. Reserved for future card-based subscription tier if demand emerges. |

## Why operator-reviewed?

**Honest accounting.** When operator enters the actual amount visible on
the slip:
- No refund mechanic required (eliminates "Anda transfer 100, kami ingin 150" UX dance)
- No automated provider integration needed for primary flow
- Client controls cash inflow timing (review 1–24h SLA acceptable for non-time-sensitive top-up)
- Edge cases (typo, wrong amount, fake slips) get human judgment

**Cost of this choice**: operator workload scales with user growth. We
plan to flip to Omise auto-payment as the primary path once KYC is done.
Manual flow then becomes a backup/fallback option.

## Premium redemption — grant stacking

The stacking math (from `services/premium_redemption.ts`):

```ts
const baseMs = Math.max(currentExpiryMs, now.getTime());
return addMonthsIso(new Date(baseMs).toISOString(), bundleMonths);
```

So:
- Redeem while free / expired: new expiry = `now + N months`
- Redeem while still premium: new expiry = `current_expiry + N months`

The user **never loses days**. They can stack 2 months upfront and the
expiry pushes 60 days from current expiry.

LIFF marketplace UI shows the projected expiry so users see "หมดอายุ
ใหม่ 11 ก.ย. 2569" before they confirm.

## Revoke flow (operator made a mistake)

Sometimes an operator approves a payment that turns out to be invalid
(fake slip, duplicate, charge-back, etc.). Superadmin can **revoke**
an approved payment from `/payments/:id` in the admin dashboard.

What happens:
1. Compensating ledger entry `revoke_topup` deducts the credit
2. If user already spent the credit on premium, balance hits 0 (no
   negative balance allowed). User keeps the premium they already
   redeemed — superadmin can manually revert via `/users/:id` if needed.
3. `manual_payments.status` flips to `revoked` (audit visible)
4. Operator records a reason

Revoke is **superadmin only** — operators cannot undo their own
approvals.

## Where the slip files live

Uploaded slips are stored on the **Railway volume** at `/data/slips/`
(prod) or `./data/slips/` (dev). Each slip filename is a random UUID +
the extension matching its mime type.

The DB row in `manual_payments` carries `slip_file_path`,
`slip_mime_type`, `slip_size_bytes`. Both user and admin can fetch the
slip via authenticated routes (different routes, same source file).

## Going deeper

- [Credit system](/docsfordevtina/payments/credit-system/) — ledger
  schema, source types, the `applyCreditMutation` atomic transaction
- [Manual top-up flow](/docsfordevtina/payments/manual-topup/) — full
  user + operator user flow, edge cases, abuse handling
- [Webhook signature](/docsfordevtina/payments/webhook-signature/) —
  HMAC details for Omise (still relevant for the dormant code that will
  reactivate post-KYC)
- [Omise integration](/docsfordevtina/payments/omise/) — Omise client
  implementation (currently dormant, ready to reactivate)

## Cost model (manual top-up)

| Item | Cost |
|---|---|
| User transfers via PromptPay | **0 THB fee** (PromptPay is free in Thailand for personal accounts) |
| Operator time to review | ~30 sec / submission once workflow is muscle memory |
| Backend cost | Negligible (one DB write, one ledger entry, one push notification) |
| **Net per top-up** | ~100% of user payment retained |

When Omise auto-payment is reactivated post-KYC, fees will be:
- PromptPay via Omise: ~3.65%
- TrueMoney Wallet: ~3.65% (varies)
- Net ~96% retained

The manual model retains 100% but requires operator time. Trade-off.

## Shipped extensions to the credit model

- **7-day bundle** (49 credit) added in Sprint 6 M6 — the entry tier
  promoted by webhook premium gates.
- **Themes marketplace** (Sprint 6 M5): 6 LIFF themes priced in credit
  (default free, others 50–80 credit). Same `applyCreditMutation` flow,
  source_type `theme_purchase`. See [data model](/docsfordevtina/architecture/data-model/#user_themes-sprint-6-m5).
- **Peer-to-peer gifts** (Sprint 6 M6): sender spends credit to grant
  premium days or theme ownership to recipient via a LIFF claim link.
  **NOT credit transfer** — recipient receives a non-fungible
  entitlement, not money. See [invariant #14](/docsfordevtina/architecture/key-invariants/#14-gifts-grant-entitlements-not-credit).
- **Admin promo display**: `original_price_X_credit` settings drive the
  discount badge + strikethrough in LIFF without affecting actual charge.

## Future ideas

- **Bulk discount tiers** at admin's discretion (e.g. 12 mo = 1500 credit
  instead of 1800) — change one row in `system_settings`
- **Day Pass** (25 credit = 1 day) for ad-hoc trial users (the 7-day
  bundle currently covers this need)
- **Streak milestone bonus credit** (auto-grant on hitting 7 / 30 / 100
  day streaks) — needs client approval before implementing
- **Annual plan promotion** with PromptPay + a discount
