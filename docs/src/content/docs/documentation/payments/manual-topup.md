---
title: Manual Top-up Flow
description: Full user submission flow + operator review workflow + abuse flag system + high-value threshold escalation.
sidebar:
  order: 3
---

The primary cash inflow path. User picks an amount, scans a generated
PromptPay QR, transfers via their bank app, uploads a slip, and an
operator reviews + approves. Credit lands in the user's wallet.

## State machine

```
[awaiting_slip] ─── user uploads slip ──▶ [pending]
                                           │
[pending] ──── operator approves ──────▶ [approved]    (terminal, credit granted)
[pending] ──── operator rejects ───────▶ [rejected]    (terminal, no credit)
[pending] ──── high-value escalation ──▶ [flagged_review]
[flagged_review] ─── superadmin approves ▶ [approved]
[flagged_review] ─── superadmin rejects ─▶ [rejected]
[approved] ──── superadmin revokes ────▶ [revoked]     (terminal, credit deducted)
```

Status transitions are enforced at the DB layer (CHECK constraint) and
at the service layer (`manual_payment.ts` orchestrator). Operators
cannot, for example, "un-reject" a submission — they'd need superadmin
to manually `adjust-credit` if there was a mistake.

## User flow (LIFF)

### Step 1 — Pick method

User navigates `/premium` → tap **"เติมเครดิต"** (Top up credit) →
`/premium/topup` shows method picker:

- **Manual PromptPay** (active)
- **Omise auto-payment** (Coming Soon, disabled)

### Step 2 — Pick amount

`/premium/topup/manual` shows:
- 5 preset tiers: **50 / 100 / 200 / 500 / 1000 THB**
- **Custom** input field (min `topup_min_satang`, max `topup_max_satang`,
  configurable in admin settings)

Backend constraint: only ONE `awaiting_slip` or `pending` submission per
user at a time (`ALREADY_HAS_AWAITING_SLIP` / `ALREADY_HAS_PENDING` error
codes). Prevents users spamming submissions.

### Step 3 — Generate QR

`POST /api/v1/topup/manual/start` body `{amount_thb}`:
1. Validates against blocked status (`USER_BLOCKED` → 403)
2. Validates amount in `[min, max]` from settings (`AMOUNT_OUT_OF_RANGE` → 400)
3. Creates `manual_payments` row with `status='awaiting_slip'` and
   `requested_amount_satang = amount_thb * 100`
4. Calls `generatePromptPayQr()` (services/promptpay_qr.ts):
   - Reads `promptpay_id` + `promptpay_receiver_name` from `system_settings`
   - Uses `promptpay-qr` npm lib to build the EMVCo payload
   - Renders to data URL via `qrcode` npm lib (PNG)
5. Returns `{ payment_id, qr_data_url, promptpay_receiver_id, promptpay_receiver_name, amount_satang }`

### Step 4 — Scan + transfer

User opens any Thai bank app (Kasikorn, SCB, Krungthai, Bangkok Bank, ...),
scans the QR, confirms amount, transfers.

The amount in the QR is **baked in** — all Thai banks pre-fill it. Some
banks (Bangkok Bank, TTB, Krungsri) allow user to edit the amount; this
is fine because the operator records the *actual* amount from the slip
later. See [Payments overview](/documentation/payments/overview/) for why
operator-records-actual is the design choice.

### Step 5 — Upload slip

User returns to LIFF, taps **"ฉันโอนแล้ว แนบสลิป"**, picks slip image
from gallery/camera.

`POST /api/v1/topup/manual/:paymentId/upload-slip` (multipart):
- `multer` validates: max 5 MB, MIME in `image/jpeg|png|webp`
- Saves to `<SLIP_STORAGE_DIR>/<uuid>.<ext>` (default
  `/data/slips/` on Railway volume)
- Updates `manual_payments` row with `slip_file_path`, `slip_mime_type`,
  `slip_size_bytes`, transitions `status='pending'`

If the file write fails AFTER the row is updated... well, it can't —
we save the file first, then the SQL update is atomic. On failure mid-flow
we `deleteSlip(saved.file_path)` to avoid orphan files.

### Step 6 — Wait for review

LIFF `/premium` now shows the submission in the "Recent submissions"
list with status badge **"รอการตรวจสอบ"** (Pending). 1–24h SLA.

## Operator flow (admin dashboard)

### Step 1 — See pending list

Operator logs into `admin.tinadiet.com`. Lands on `/payments/pending`.

The list shows oldest-first (FIFO queue) so the longest-waiting user
gets reviewed next. Each row shows:
- Submission ID
- User display name + abuse warning count badge (⚠️ if > 0)
- Requested amount (e.g. "500 ฿")
- "X hours ago" timestamp
- "Review" button

### Step 2 — Open detail view

`/payments/:id` renders:
- **User panel**: display name, LINE user ID, current credit balance, abuse warnings (if any), link to full user detail
- **Submission panel**: requested amount, status, timestamps
- **Slip image**: fetched as blob with admin JWT and displayed fullscreen
- **Action panel** (only if pending/flagged_review): Approve / Reject buttons

### Step 3 — Cross-check vs. bank statement

Operator opens their own mobile banking app or web banking, finds the
incoming transfer matching the slip, verifies:
- Sender name matches what's expected (e.g. matches user's LINE display name)
- Amount on slip matches amount in bank
- Date/time on slip aligns
- Slip looks like a genuine bank app screenshot (no signs of editing)

### Step 4 — Approve

Operator clicks **Approve** → form panel opens:
- **Actual amount field**: pre-filled with `requested_amount_satang / 100`,
  editable. Operator types in what they see on the slip.
- **Admin notes** (optional, internal only)
- **Flag user as abuse** checkbox (if slip seems suspicious)
- **Confirm Approve**

`POST /api/v1/admin/payments/:id/approve` body:
```json
{
  "actual_amount_satang": 50000,
  "admin_notes": "Slip clear, name matches",
  "flag_user_as_abuse": false
}
```

Inside the service:
1. Read-only validation (payment exists, status pending/flagged_review,
   amount integer > 0)
2. **High-value escalation check** (see below) — if amount ≥
   `high_value_threshold_satang` AND operator role != superadmin,
   auto-promote to `flagged_review` in its own transaction and throw
   `HIGH_VALUE_NEEDS_SUPERADMIN`
3. Main approval transaction:
   - Mark payment row `status='approved'`, `actual_amount_satang`, `credit_granted_satang`, `reviewed_by_admin_id`, `reviewed_at`
   - Call `applyCreditMutation` to grant credit + write ledger entry
   - Optionally record an `abuse_warning` flag

### Step 5 — Reject (alternative)

Operator clicks **Reject** → form panel:
- **Rejection reason** (required, user-visible)
- **Flag as abuse** checkbox (optional)
- **Confirm Reject**

`POST /api/v1/admin/payments/:id/reject` body:
```json
{
  "rejection_reason": "Slip tidak jelas, mohon kirim ulang",
  "flag_user_as_abuse": false
}
```

Status transitions to `rejected`. User sees the reason in their LIFF
submission history and can submit a new top-up (no cooldown).

## High-value threshold escalation

`system_settings.high_value_threshold_satang` (default 500000 = 5,000 THB)
gates large approvals.

When a regular operator tries to approve `actual_amount_satang ≥ threshold`:
1. Submission status is **auto-promoted** to `flagged_review` in its own
   transaction (NOT inside the rolled-back approval tx)
2. The approve call throws `HIGH_VALUE_NEEDS_SUPERADMIN`
3. UI displays the escalation message; submission disappears from
   regular pending list and shows up only for superadmin

Why escalate in a separate transaction? Because the approval tx
rolls back on the throw, but the status change must persist. Separating
the writes makes both behaviors correct without complex rollback logic.

Superadmin reviewing a `flagged_review` submission bypasses the
threshold check.

## Abuse flag system

**Level B Tiered Escalation** (decided in Sprint 6 M4 planning):

| Warning count | Behavior |
|---|---|
| 0 | Normal |
| 1 | Visible badge "⚠️ 1 warning" to operators on this user's future submissions |
| 2 | Same, "⚠️ 2 warnings" |
| ≥ 3 | Future submissions auto-flagged for `flagged_review` (superadmin only) — applied at submission time, not approval time. Currently the check happens on approve; could be moved to upload-slip if needed. |
| ≥ 5 | User auto-blocked (`users.is_blocked=1`); cannot create new top-ups (`USER_BLOCKED` → 403 on `/topup/manual/start`) |

Operators set the flag when approving OR rejecting:
- Approve + flag = "I'm granting credit but this is borderline, count
  toward warnings"
- Reject + flag = "Definitely abusing"

Each flag inserts a `user_flags` row + `users.abuse_warning_count++` in
a single transaction. Superadmin can clear all active flags via
`/users/:id/clear-warnings` (sets `cleared_at` + `cleared_by_admin_id`
on each flag and resets `abuse_warning_count` to 0).

## Revoke flow

Superadmin only. From `/payments/:id` of an approved payment, the
"Revoke" action panel appears.

```
POST /api/v1/admin/payments/:id/revoke
{ "revoke_reason": "Duplicate of #42, charge-back from bank" }
```

What happens (`services/manual_payment.ts::revokeApprovedManualPayment`):
1. Validate payment status = 'approved' and `credit_granted_satang > 0`
2. Compute `deductSatang = min(user.credit_balance_satang, grantedSatang)` —
   never push the balance negative
3. `applyCreditMutation` with `source_type='revoke_topup'`, negative
   amount, `source_ref_id=payment.id`
4. Mark payment `status='revoked'`, `revoked_by_admin_id`, `revoked_at`,
   `revoke_reason`
5. Return `{ credit_deducted_satang, balance_went_to_zero }`

If user already spent the credit on premium (`balance_went_to_zero=true`),
the operator gets a UI hint suggesting they may also need to manually
adjust premium status via `/users/:id`. Premium days are NOT
auto-revoked — operator decides case by case.

## Notification to user

After approve / reject, the backend pushes a LINE message to the user
explaining what happened. (Implementation note: Sprint 6 M4 leaves this
as a follow-up if not already in `services/manual_payment.ts`. Verify
in current source.)

Push contents (when implemented):
- **Approved**: "เติมเครดิต X บาท สำเร็จ! ยอดเครดิตปัจจุบัน: Y"
- **Rejected**: "การเติมเครดิตของคุณถูกปฏิเสธ: <reason>. สามารถส่งใหม่ได้"

## Edge cases handled

- **Concurrent operator reviews** — `markReviewed` uses `WHERE status IN
  ('pending', 'flagged_review')`. Second operator to click Approve gets
  0 changed rows → throw `WRONG_STATUS`. Whoever's first wins, no race.
- **Slip file corrupted on disk** — `readSlipBuffer()` returns
  `SlipStorageError('NOT_FOUND')`, admin sees 404 on the slip endpoint
  but can still approve/reject based on context.
- **User deletes account before review** — CASCADE delete drops the
  `manual_payments` row + the slip stays as orphan file on disk
  (acceptable; manual cleanup or add a cron sweeper later).
- **Operator approves the same row twice** — second click gets
  `WRONG_STATUS` because row is no longer in pending/flagged_review.
- **Negative balance attempt** — `applyCreditMutation` throws
  `INSUFFICIENT_BALANCE`; the entire transaction rolls back, no partial
  state.

## Tunable settings

All editable in admin dashboard `/settings` (superadmin only):

| Key | Default | Description |
|---|---|---|
| `topup_min_satang` | 5000 (50 THB) | Minimum allowed top-up |
| `topup_max_satang` | 500000 (5000 THB) | Maximum allowed top-up |
| `high_value_threshold_satang` | 500000 (5000 THB) | Above this → needs superadmin |
| `promptpay_id` | (empty — must be configured before first top-up) | PromptPay receiver ID |
| `promptpay_id_type` | `mobile` | `mobile` / `nid` / `tax` |
| `promptpay_receiver_name` | (empty) | Display name on QR confirmation screen |
| `price_*_credit` | 150 / 450 / 900 / 1800 | Premium bundle pricing |
