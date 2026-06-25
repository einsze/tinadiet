---
title: Credit System
description: Credit ledger schema, source types, atomic mutations, and the invariants you must not break.
sidebar:
  order: 2
---

The credit system is a **single ledger** that backs all monetization in
Tina Diet. Every change to a user's credit balance flows through one
function: `applyCreditMutation()` in `backend/src/services/credit.ts`,
which writes a `credit_ledger` row AND updates `users.credit_balance_satang`
inside the same SQLite transaction.

## Invariants (do not break)

1. **Every balance change must have a ledger row.** Never write to
   `users.credit_balance_satang` directly — always via `applyCreditMutation`.
2. **Balance never goes negative.** `applyCreditMutation` throws
   `CreditError('INSUFFICIENT_BALANCE')` if the mutation would drop the
   balance below 0.
3. **Ledger entries are immutable.** No UPDATE statements on `credit_ledger`.
   Corrections happen via compensating entries (e.g. `revoke_topup`).
4. **`balance_after_satang` is computed at write time** and stored. This
   lets you reconcile by replay: sum all amount_satang for a user, compare
   to the latest balance_after_satang.
5. **All money is integer satang.** 1 THB = 100 satang. Never floating-point.

## Ledger schema

```sql
CREATE TABLE credit_ledger (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_satang         INTEGER NOT NULL,        -- signed: +earn / -spend
  balance_after_satang  INTEGER NOT NULL,        -- snapshot for reconciliation
  source_type           TEXT NOT NULL CHECK(source_type IN (
                          'manual_topup',
                          'omise_topup',
                          'admin_grant',
                          'redeem_premium',
                          'theme_purchase',
                          'gift_send',
                          'gift_refund',
                          'revoke_topup',
                          'revoke_redeem'
                        )),
  source_ref_id         INTEGER,                  -- FK to source table (e.g. manual_payments.id)
  admin_user_id         INTEGER REFERENCES admin_users(id),
  note                  TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_credit_ledger_source ON credit_ledger(source_type, source_ref_id);
```

## Source types

| `source_type` | Sign | Created by | Description |
|---|---|---|---|
| `manual_topup` | + | Operator approves slip | Primary cash inflow today |
| `omise_topup` | + | Omise webhook (post-KYC) | Future inflow when Omise activated |
| `admin_grant` | + or − | Superadmin via `/users/:id/adjust-credit` | Manual grant or deduct (rare) |
| `redeem_premium` | − | User redeems premium bundle in LIFF | Spend for 7d/1/3/6/12 month premium |
| `theme_purchase` | − | User buys a LIFF theme (Sprint 6 M5) | Spend for theme ownership |
| `gift_send` | − | User creates a gift in LIFF (Sprint 6 M6) | Escrow at gift create time |
| `gift_refund` | + | Gift transitions to cancel/expire/refuse/revoke | Auto-refund to sender |
| `revoke_topup` | − | Superadmin revokes approved payment | Compensating entry |
| `revoke_redeem` | − | Future: revoke premium grant | Not yet implemented |

`source_ref_id` points to the originating row:
- `manual_topup` → `manual_payments.id`
- `omise_topup` → `payments.id` (future)
- `admin_grant` → null (operator's adjust is direct)
- `redeem_premium` → null (premium grant has no separate table — just user's `premium_expires_at`)
- `theme_purchase` → `user_themes.id`
- `gift_send` → `gifts.id`
- `gift_refund` → `gifts.id`
- `revoke_topup` → `manual_payments.id`

## The atomic mutation

```ts
// services/credit.ts
export const applyCreditMutation = (
  input: CreditMutationInput
): CreditMutationResult => {
  const tx = db.transaction(() => {
    const user = userRepository.findById(input.user_id);
    const newBalance = user.credit_balance_satang + input.amount_satang;
    if (newBalance < 0) {
      throw new CreditError('Insufficient balance', 'INSUFFICIENT_BALANCE');
    }
    const updatedUser = userRepository.updateCreditBalance(input.user_id, newBalance);
    const entry = creditLedgerRepository.create({
      user_id: input.user_id,
      amount_satang: input.amount_satang,
      balance_after_satang: newBalance,
      source_type: input.source_type,
      source_ref_id: input.source_ref_id,
      admin_user_id: input.admin_user_id,
      note: input.note,
    });
    return { user: updatedUser, ledger_entry: entry };
  });
  return tx();
};
```

**better-sqlite3** runs transactions synchronously — `db.transaction()`
wraps the callback in a BEGIN/COMMIT. If the callback throws (including
from the balance check), SQLite ROLLs BACK and we propagate the error.

This means: **you cannot leave the database in a state where
`users.credit_balance_satang` disagrees with the sum of the user's
ledger entries.** Either both move, or neither.

## Convenience helpers

```ts
grantCredit({ user_id, amount_satang: 15000, source_type: 'manual_topup', ... })
// throws if amount_satang <= 0

spendCredit({ user_id, amount_satang: 15000, source_type: 'redeem_premium', ... })
// internally calls applyCreditMutation with negated amount
```

Both wrap `applyCreditMutation` with sign-direction guards.

## Where mutations happen (callers)

| Caller | Direction | Mutation source |
|---|---|---|
| `services/manual_payment.ts::approveManualPayment` | + | `manual_topup` |
| `services/manual_payment.ts::revokeApprovedManualPayment` | − | `revoke_topup` |
| `services/premium_redemption.ts::redeemPremium` | − | `redeem_premium` |
| `routes/api/themes.ts::POST /:slug/purchase` | − | `theme_purchase` |
| `services/gifts.ts::createGift` | − | `gift_send` |
| `services/gifts.ts::cancelGift / expirePendingGifts / handleRefused / revokeGift` | + | `gift_refund` |
| `routes/api/admin/users.ts::POST /adjust-credit` | +/− | `admin_grant` |
| (post-KYC) Omise webhook handler | + | `omise_topup` |

That's the entire surface. **Do not add a new caller without going
through `applyCreditMutation`** — direct UPDATE statements on
`users.credit_balance_satang` would silently break reconciliation.

## Reconciliation query

To verify the ledger and the user balance agree:

```sql
SELECT
  u.id,
  u.display_name,
  u.credit_balance_satang AS users_balance,
  COALESCE(SUM(l.amount_satang), 0) AS ledger_sum,
  u.credit_balance_satang - COALESCE(SUM(l.amount_satang), 0) AS drift
FROM users u
LEFT JOIN credit_ledger l ON l.user_id = u.id
GROUP BY u.id
HAVING drift != 0;
```

Empty result = healthy. Any row = bug somewhere. **Run this periodically**
or set up a cron alert.

## Why store `balance_after_satang`?

You could derive the balance for any historical point by replaying the
ledger from the start, but:

1. **Audit speed** — a single row tells you the user's balance at that
   point in time. No replay needed for "what was this user's balance
   when this transaction happened?"
2. **UI speed** — admin dashboard shows ledger entries with
   `balance_after_satang` already computed; no rolling sum at render time
3. **Drift detection** — discrepancies show up immediately (see
   reconciliation query above)

The cost is one extra column per row. Cheap.

## Future ideas

- **Credit expiry** — currently no expiry (per locked decision in Sprint 6
  M4 planning). If client later wants 1-year expiry, add `expires_at` to
  ledger rows + a sweeper cron
- **Per-source ceiling reports** — "how much was earned via manual_topup
  this month?" is one GROUP BY away
- **Per-operator approval volume** — same query grouped by `admin_user_id`
- **Anonymization on user delete** — currently CASCADE deletes ledger
  rows. If we need to preserve aggregate accounting, switch to soft-delete
  + null the user_id
