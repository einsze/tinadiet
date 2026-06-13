---
title: Manual Grants
description: How to grant or revoke premium without going through payment.
sidebar:
  order: 2
---

Sometimes you need to grant premium without an actual Omise payment — beta
testers, manual support recovery, partnership trials.

## When this is appropriate

- **Beta testers** before LIVE launch
- **Support recovery** if a real payment didn't apply due to webhook issue
  (rare; the polling fallback usually catches this)
- **Comp/promotion** to specific users
- **Internal testing** by team members

## When this is NOT appropriate

- Random users requesting freebies (use Stripe coupon when reactivated, or
  add a promo code feature)
- Bulk grants (write a script or batch SQL, document)
- Replacing the actual payment flow during normal operations

## How to grant

Via Railway Console (preferred — leaves no trace in source code):

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const u=db.prepare("UPDATE users SET plan=\"premium\", premium_expires_at=datetime(\"now\",\"+30 days\"), updated_at=datetime(\"now\") WHERE line_user_id = ?").run("<LINE_ID>");console.log("Rows updated:", u.changes);'
```

Replace `<LINE_ID>` with the user's `line_user_id` (starts with `U`,
~32 chars). Find it via:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");console.log(db.prepare("SELECT id, line_user_id, display_name FROM users WHERE display_name = ?").get("<DISPLAY_NAME>"));'
```

## How to verify

After the grant:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const row=db.prepare("SELECT id, display_name, plan, premium_expires_at FROM users WHERE line_user_id = ?").get("<LINE_ID>");console.log(JSON.stringify(row, null, 2));'
```

Expected output:
```json
{
  "id": 1,
  "display_name": "<example>",
  "plan": "premium",
  "premium_expires_at": "2026-07-13 17:28:00"
}
```

## Stacking behavior

The grant SQL uses `datetime("now","+30 days")` which **does NOT stack**.
If the user is already premium, this resets the expiry to 30 days from now
(potentially shrinking their premium period if they had >30 days).

To **stack** instead (preserve existing expiry):

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const u=db.prepare("UPDATE users SET plan=\"premium\", premium_expires_at = datetime(COALESCE(premium_expires_at, datetime(\"now\")), \"+30 days\"), updated_at=datetime(\"now\") WHERE line_user_id = ?").run("<LINE_ID>");console.log("Rows updated:", u.changes);'
```

The `COALESCE(premium_expires_at, datetime("now"))` ensures the base is
"now" for users without a current expiry, otherwise it's their current
expiry.

## Revoking

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const u=db.prepare("UPDATE users SET plan=\"free\", premium_expires_at=NULL, updated_at=datetime(\"now\") WHERE id = ?").run(2);console.log("Rows updated:", u.changes);'
```

Replace `2` with target user_id.

## Audit trail

Manual grants leave NO record in the `payments` table — only the `users`
row is updated. For traceability:

1. Log the grant in your incident management / support tool
2. Note: who granted, to whom, why, how long
3. Add to `feedback_*_grants.md` memory file if pattern emerges

If audit is critical, consider inserting a stub `payments` row with
`status='manual_grant'` (would require a CHECK constraint update or
schema extension).

## Auto-expiry

The `expire_premium` cron runs daily at 02:00 ICT and reverts all expired
premiums to free. No manual cleanup needed — just grant with the right
end date and the cron handles the rest.

For an indefinite grant (e.g. lifetime free premium for a co-founder),
use a far-future expiry:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");const u=db.prepare("UPDATE users SET plan=\"premium\", premium_expires_at=\"2099-12-31\", updated_at=datetime(\"now\") WHERE line_user_id = ?").run("<LINE_ID>");console.log("Rows updated:", u.changes);'
```

## Common patterns

### Beta tester
Granted premium for a fixed period via SQL on Railway. After the expiry
date, the nightly cron will revert to free. To extend, run the stacking
SQL above.

### Developer test account
Stacked multiple TEST charges to push expiry far into the future for
e2e testing. Will revert via cron once stops paying — this is
intentional, no cleanup needed.

## See also

- [Payments overview](/documentation/payments/overview/) — how premium
  works
- [Architecture — Key invariants — Rule 11](/documentation/architecture/key-invariants/#11-single-source-of-truth-for-ispremium)
  — `isPremium` semantics
- [DB queries](/documentation/ops/db-queries/) — full snippet runbook
