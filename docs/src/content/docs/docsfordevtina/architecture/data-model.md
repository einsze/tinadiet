---
title: Data Model
description: SQLite schema, relationships, and key conventions.
sidebar:
  order: 2
---

The database is **SQLite** via `better-sqlite3`, file at `/data/app.db` on
the Railway volume in production, `backend/data/app.db` in dev. Schema is
managed by versioned migrations in `backend/src/db/migrations.ts`.

## Tables

### `users`
Primary aggregate. Tracks identity, profile, computed goals, plan, and
credit balance.

```sql
CREATE TABLE users (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id           TEXT NOT NULL UNIQUE,
  display_name           TEXT,
  gender                 TEXT CHECK(gender IN ('male','female','other')),
  date_of_birth          TEXT,
  height_cm              REAL,
  current_weight_kg      REAL,
  target_weight_kg       REAL,
  activity_level         TEXT CHECK(activity_level IN
                           ('sedentary','light','moderate','active','very_active')),
  goal_type              TEXT CHECK(goal_type IN ('loss','maintain','gain')),
  bmr_kcal               REAL,
  tdee_kcal              REAL,
  daily_calorie_goal     REAL,
  daily_protein_g        REAL,
  daily_carbs_g          REAL,
  daily_fat_g            REAL,
  locale                 TEXT NOT NULL DEFAULT 'th-TH',
  timezone               TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  plan                   TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','premium')),
  premium_expires_at     TEXT,
  stripe_customer_id     TEXT,
  omise_customer_id      TEXT,
  credit_balance_satang  INTEGER NOT NULL DEFAULT 0,     -- added 0008
  abuse_warning_count    INTEGER NOT NULL DEFAULT 0,     -- added 0008
  is_blocked             INTEGER NOT NULL DEFAULT 0,     -- added 0008
  active_theme_slug      TEXT,                           -- added 0009 (S6 M5)
  support_mode_until     TEXT,                           -- added 0013 (2026-06-25)
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Notes**
- `daily_calorie_goal IS NOT NULL` is the canonical "profile complete" check.
  See `domain/profile.ts` `isProfileComplete()`.
- `plan='premium' AND premium_expires_at > now` is the canonical "is
  premium" check. See `domain/profile.ts` `isPremium()`.
- `credit_balance_satang` is the user's wallet. Read-only for application
  code outside `services/credit.ts` — mutations only via
  `applyCreditMutation`. See [Credit system](/docsfordevtina/payments/credit-system/).
- `abuse_warning_count` increments per operator-flagged submission. 3+ →
  future submissions auto-route to superadmin review. 5+ → user blocked.
- `is_blocked` set automatically at 5 warnings, or manually by superadmin.
  When 1, user cannot create new top-ups (`USER_BLOCKED` error).
- `active_theme_slug` references the user's currently-selected LIFF theme
  (default, sakura, ocean, forest, sunset, midnight). Theme palette is
  swapped via CSS variables at runtime.
- `support_mode_until` (nullable ISO timestamp). When > `now`, all text +
  image messages to the LINE bot are auto-ACKed and food parser /
  consultation / vision parsing are suppressed. Team Tina replies via OA
  Manager Chats tab. User exits via `exit`/`ออก`/etc. or 30-minute auto-
  expire. Set when user types `support` keyword in chat.
- `stripe_customer_id` + `omise_customer_id` reserved for future
  reactivation; both providers currently dormant. Active payment flow is
  manual PromptPay → credit ledger → bundle redeem.

### `food_logs`
One row per logged item. Multi-item AI parses (e.g. "ผัดกะเพรา + ไข่ดาว")
create multiple rows.

```sql
CREATE TABLE food_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_at       TEXT NOT NULL DEFAULT (datetime('now')),
  date            TEXT NOT NULL,             -- denormalized in user TZ at insert
  meal_type       TEXT CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
  food_name_th    TEXT,
  food_name_en    TEXT,
  quantity_text   TEXT,
  kcal            REAL NOT NULL,
  kcal_low        REAL,                       -- range support (0004)
  kcal_high       REAL,
  protein_g       REAL NOT NULL DEFAULT 0,
  carbs_g         REAL NOT NULL DEFAULT 0,
  fat_g           REAL NOT NULL DEFAULT 0,
  source          TEXT NOT NULL CHECK(source IN ('manual','chat_regex','chat_ai','photo')),
  raw_text        TEXT,
  confidence      REAL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Notes**
- `date` is denormalized in user TZ (`Asia/Bangkok`) at insert via
  `domain/date.ts` `todayInTimezone()`. Used for "today's logs" queries
  without timezone math at read time.
- `source='photo'` means parsed via gpt-4o vision; counted toward
  premium quota.
- `kcal_low` / `kcal_high` model uncertainty (e.g. AI sees a photo and
  estimates 350-450 kcal). `kcal` is the midpoint.
- `confidence` is a 0-1 score from the parser.

### `weight_logs`
Time series of user weight measurements.

```sql
CREATE TABLE weight_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_at   TEXT NOT NULL DEFAULT (datetime('now')),
  date        TEXT NOT NULL,
  weight_kg   REAL NOT NULL,
  note        TEXT,
  source      TEXT NOT NULL CHECK(source IN ('manual','chat')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

When a weight log is inserted, `userRepository.syncWeightChange()`
updates `users.current_weight_kg` and recomputes goals if profile is
complete.

### `chat_messages`
Persisted conversation for consultation feature (premium).

```sql
CREATE TABLE chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content     TEXT NOT NULL,
  date        TEXT NOT NULL,
  refused     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`refused=1` marks the assistant message as an out-of-scope refusal (e.g.
medical questions, detailed workout plans). Useful for monitoring and
refining `SYSTEM_PROMPT` in `consultation.ts`.

### `subscriptions`
Stripe-only history. Each Stripe subscription = one row. **Currently
dormant** — payment pivoted first to Omise (also dormant pending KYC),
then to manual PromptPay top-up + credit ledger as the primary flow.

```sql
CREATE TABLE subscriptions (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider                 TEXT NOT NULL CHECK(provider IN ('stripe')),
  provider_subscription_id TEXT NOT NULL,
  provider_customer_id     TEXT NOT NULL,
  status                   TEXT NOT NULL,
  current_period_start     TEXT,
  current_period_end       TEXT,
  cancel_at_period_end     INTEGER NOT NULL DEFAULT 0,
  canceled_at              TEXT,
  last_event_type          TEXT,
  last_event_at            TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `payments`
Omise charges history (one row per charge). Created in Sprint 6 M1 for
the manual-renewal payment model.

```sql
CREATE TABLE payments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL CHECK(provider IN ('omise')),
  provider_charge_id  TEXT NOT NULL,
  provider_source_id  TEXT,
  method              TEXT NOT NULL CHECK(method IN ('promptpay','truemoney')),
  amount_satang       INTEGER NOT NULL,         -- 150 THB = 15000 satang
  currency            TEXT NOT NULL DEFAULT 'thb',
  status              TEXT NOT NULL CHECK(status IN
                        ('pending','successful','failed','expired','reversed')),
  failure_code        TEXT,
  failure_message     TEXT,
  authorize_uri       TEXT,                     -- TrueMoney redirect URL
  qr_image_uri        TEXT,                     -- PromptPay QR PNG URL
  expires_at          TEXT,
  completed_at        TEXT,
  grant_days          INTEGER NOT NULL DEFAULT 30,
  grant_starts_at     TEXT,                     -- for stacking math
  grant_ends_at       TEXT,
  last_event_type     TEXT,
  last_event_at       TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Notes**
- `amount_satang` is the Omise convention: 1 THB = 100 satang. Always integer,
  no floating-point risk.
- `(provider, provider_charge_id)` has a UNIQUE index → idempotent webhook
  upserts.
- `grant_starts_at` / `grant_ends_at` capture the stacking computation at
  the time of grant.

### `admin_users` (Sprint 6 M4)
Operator + superadmin login + audit. Separate from `users` because admin
auth is independent (email + bcrypt password) from user auth (LINE Login).

```sql
CREATE TABLE admin_users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  email                TEXT    NOT NULL UNIQUE,
  password_hash        TEXT    NOT NULL,                  -- bcrypt cost 10
  display_name         TEXT    NOT NULL,
  role                 TEXT    NOT NULL CHECK(role IN ('superadmin','operator')),
  is_active            INTEGER NOT NULL DEFAULT 1,
  last_login_at        TEXT,
  created_by_admin_id  INTEGER REFERENCES admin_users(id),
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**Notes**
- Migration 0008 seeds 2 superadmin rows for the project owner. Initial
  passwords are stored in the local SECRETS file; owner rotates manually
  via admin `/account` page on their own schedule (no forced rotation).
- `created_by_admin_id` references admin_users itself (NULL for seeded
  rows). Self-FK is intentional for audit ("who created which operator").
- Deactivate (`is_active=0`) rather than delete — keeps audit links on
  past payment reviews intact.

### `manual_payments` (Sprint 6 M4)
One row per top-up submission. Lifecycle:
`awaiting_slip → pending → approved | rejected | revoked`.

```sql
CREATE TABLE manual_payments (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_amount_satang    INTEGER NOT NULL,
  actual_amount_satang       INTEGER,                    -- set at approve, from slip
  slip_file_path             TEXT,                       -- /data/slips/<uuid>.<ext>
  slip_mime_type             TEXT,
  slip_size_bytes            INTEGER,
  status                     TEXT    NOT NULL DEFAULT 'awaiting_slip'
                               CHECK(status IN
                                 ('awaiting_slip','pending','approved',
                                  'rejected','flagged_review','revoked')),
  reviewed_by_admin_id       INTEGER REFERENCES admin_users(id),
  reviewed_at                TEXT,
  rejection_reason           TEXT,
  admin_notes                TEXT,
  flag_user_as_abuse         INTEGER NOT NULL DEFAULT 0,
  credit_granted_satang      INTEGER,                    -- = actual_amount on approve
  revoked_by_admin_id        INTEGER REFERENCES admin_users(id),
  revoked_at                 TEXT,
  revoke_reason              TEXT,
  created_at                 TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**Notes**
- `actual_amount_satang` can differ from `requested_amount_satang` —
  operator records what's actually on the slip (eliminates refund
  edge cases).
- `flagged_review` status means "needs superadmin review" — auto-promoted
  by the approve handler when amount ≥ `high_value_threshold_satang` and
  the calling operator isn't superadmin.
- `revoked` is terminal; once revoked, ledger has a compensating
  `revoke_topup` entry deducting the granted credit.
- Slip files at `slip_file_path` are stored on the Railway volume (not in
  DB). See [Manual top-up flow](/docsfordevtina/payments/manual-topup/).

### `credit_ledger` (Sprint 6 M4)
Immutable audit log of every credit mutation. Source of truth for
reconciliation. See [Credit system](/docsfordevtina/payments/credit-system/)
for the full design.

```sql
CREATE TABLE credit_ledger (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_satang         INTEGER NOT NULL,                -- signed: + earn, - spend
  balance_after_satang  INTEGER NOT NULL,                -- snapshot
  source_type           TEXT    NOT NULL CHECK(source_type IN (
                          'manual_topup','omise_topup','admin_grant',
                          'redeem_premium','theme_purchase',
                          'gift_send','gift_refund',
                          'revoke_topup','revoke_redeem')),
  source_ref_id         INTEGER,
  admin_user_id         INTEGER REFERENCES admin_users(id),
  note                  TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

`source_type` enum extended over multiple migrations:
- `theme_purchase` added in 0009 (S6 M5)
- `gift_send` + `gift_refund` added in 0010 (S6 M6)

The CHECK constraint is rebuilt each time via table-copy migration since
SQLite doesn't support `ALTER TABLE ... ADD CHECK`.

**Notes**
- **Never UPDATE.** Corrections happen via compensating entries.
- `balance_after_satang` lets you read the user's balance at any
  historical point with a single row lookup — no replay needed.
- All inserts go through `services/credit.ts::applyCreditMutation` inside
  a SQLite transaction that also updates `users.credit_balance_satang`.

### `user_flags` (Sprint 6 M4)
Audit log of abuse warnings + manual blocks per user.

```sql
CREATE TABLE user_flags (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag_type                TEXT    NOT NULL CHECK(flag_type IN
                             ('abuse_warning','manual_block')),
  reason                   TEXT,
  related_payment_id       INTEGER REFERENCES manual_payments(id),
  flagged_by_admin_id      INTEGER NOT NULL REFERENCES admin_users(id),
  flagged_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  cleared_by_admin_id      INTEGER REFERENCES admin_users(id),
  cleared_at               TEXT,
  clear_reason             TEXT
);
```

**Notes**
- Multiple rows per user are normal (each flag is its own audit entry).
  `users.abuse_warning_count` is the cached count of un-cleared flags.
- Superadmin clearing flags sets `cleared_at` + resets `abuse_warning_count`
  to 0 in a single transaction.
- `related_payment_id` is nullable (some flags may be unrelated to a
  specific submission, e.g. retroactive flag after offline complaint).

### `user_themes` (Sprint 6 M5)
Per-user ownership ledger for purchased LIFF themes. Default theme is
free + not stored. Other themes (sakura, ocean, forest, sunset, midnight)
are bought via credit and recorded here with a price snapshot.

```sql
CREATE TABLE user_themes (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme_slug             TEXT    NOT NULL,
  price_credit_snapshot  INTEGER NOT NULL,         -- price at purchase time
  purchased_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, theme_slug)
);
```

**Notes**
- `UNIQUE(user_id, theme_slug)` prevents double-purchase.
- `price_credit_snapshot` is set from `system_settings.price_theme_<slug>_credit`
  at purchase. Even if admin later changes the price, this row keeps the
  amount actually paid — useful for revoke/refund math + reconciliation.
- Theme catalog (slug + palette + pattern SVG) is hardcoded in
  `liff/src/themes/palettes.ts`. Prices are admin-editable, but set
  `price=0` to hide the theme from the store while keeping it available
  to existing owners.
- Activation: `users.active_theme_slug` references the currently-selected
  theme. A user can buy multiple themes and switch freely.

### `gifts` (Sprint 6 M6)
Peer-to-peer gift system. A spends credit to grant Premium-time or a
Theme to B via a one-time claim link. **Not** credit transfer — the
recipient receives a non-fungible service entitlement, not currency.

```sql
CREATE TABLE gifts (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_token                TEXT    NOT NULL UNIQUE,    -- 22-char base64url, 128 bits
  sender_user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  gift_type                  TEXT    NOT NULL CHECK(gift_type IN ('premium','theme')),
  payload                    TEXT    NOT NULL,           -- JSON: {months: 1|3|6|12|'7d'} or {theme_slug}
  credit_spent_satang        INTEGER NOT NULL,
  message                    TEXT,                       -- optional personal note
  status                     TEXT    NOT NULL DEFAULT 'pending'
                               CHECK(status IN ('pending','claimed','canceled',
                                                'expired','refused','revoked')),
  claim_expires_at           TEXT    NOT NULL,           -- 7 days from create by default
  claimed_at                 TEXT,
  canceled_at                TEXT,
  expired_at                 TEXT,
  refused_at                 TEXT,
  refused_reason             TEXT CHECK(refused_reason IN
                               ('recipient_already_owns_theme','recipient_blocked','self_claim')),
  revoked_at                 TEXT,
  revoked_by_admin_id        INTEGER REFERENCES admin_users(id),
  revoke_reason              TEXT,
  applied_premium_ms_added   INTEGER,                    -- for deterministic revoke math
  applied_theme_slug         TEXT,                       -- for deterministic revoke
  created_at                 TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**Notes**
- 6-state lifecycle: `pending → claimed | canceled | expired | refused |
  revoked`. Terminal states are mutually exclusive.
- Credit escrow: debit at create (`gift_send` ledger entry), refund at any
  non-pending terminal state (`gift_refund` ledger entry).
- `claim_token` is `crypto.randomBytes(16).toString('base64url')` — 128
  bits entropy, URL-safe, no padding.
- Claim URL form is `https://liff.line.me/<LIFF_ID>/claim/<token>` (LIFF
  deep link, NOT plain `app.tinadiet.com/claim/...`) so LINE opens it in
  the LIFF webview with auth context.
- Daily cron `jobs/expire_gifts.ts` at 03:00 ICT marks `pending` rows
  past `claim_expires_at` as `expired` + auto-refunds.
- `applied_premium_ms_added` / `applied_theme_slug` capture the entitle-
  ment actually granted, so a superadmin revoke can deterministically
  unwind: subtract ms from `premium_expires_at`, or remove the theme
  ownership row (and fall back active theme to default if needed).

### `system_settings` (Sprint 6 M4)
Key-value singleton config table. Editable via admin dashboard.

```sql
CREATE TABLE system_settings (
  key                   TEXT    PRIMARY KEY,
  value                 TEXT    NOT NULL,
  updated_by_admin_id   INTEGER REFERENCES admin_users(id),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

Seeded keys (default values in parens):
- `promptpay_id` (empty) — must be configured before first top-up
- `promptpay_id_type` (`mobile`)
- `promptpay_receiver_name` (empty)
- Bundle prices in credit (1 credit = 1 THB):
  - `price_7d_credit` (`49`), `price_1mo_credit` (`150`),
    `price_3mo_credit` (`450`), `price_6mo_credit` (`900`),
    `price_12mo_credit` (`1800`)
- "Original" prices for discount badge display (0 = no badge, set higher
  than current to show `−X% OFF` strikethrough in LIFF):
  - `original_price_7d_credit`, `original_price_1mo_credit`,
    `original_price_3mo_credit`, `original_price_6mo_credit`,
    `original_price_12mo_credit` (all default `0`)
- Theme prices in credit (set 0 to hide from store):
  - `price_theme_sakura_credit`, `price_theme_ocean_credit`,
    `price_theme_forest_credit`, `price_theme_sunset_credit`,
    `price_theme_midnight_credit`
- `high_value_threshold_satang` (`500000` = 5,000 THB)
- `topup_min_satang` (`5000`, owner lowered to `4900` in production to
  match the 49 THB / 7-day bundle), `topup_max_satang` (`500000`)

All values are strings; consumers parse to number as needed.
`updated_by_admin_id` provides audit ("who last changed this setting").

## Relationships

```
users (id)
  │
  ├── food_logs.user_id          (ON DELETE CASCADE)
  ├── weight_logs.user_id        (ON DELETE CASCADE)
  ├── chat_messages.user_id      (ON DELETE CASCADE)
  ├── subscriptions.user_id      (ON DELETE CASCADE)
  ├── payments.user_id           (ON DELETE CASCADE)
  ├── manual_payments.user_id    (ON DELETE CASCADE)
  ├── credit_ledger.user_id      (ON DELETE CASCADE)
  ├── user_flags.user_id         (ON DELETE CASCADE)
  ├── user_themes.user_id        (ON DELETE CASCADE)
  ├── gifts.sender_user_id       (ON DELETE CASCADE)
  └── gifts.recipient_user_id    (ON DELETE SET NULL)  -- preserve audit trail

admin_users (id)
  ├── admin_users.created_by_admin_id (self-FK, NULL for seeded)
  ├── manual_payments.reviewed_by_admin_id
  ├── manual_payments.revoked_by_admin_id
  ├── credit_ledger.admin_user_id
  ├── user_flags.flagged_by_admin_id
  ├── user_flags.cleared_by_admin_id
  ├── system_settings.updated_by_admin_id
  └── gifts.revoked_by_admin_id

manual_payments (id)
  └── user_flags.related_payment_id   (nullable)
```

Deleting a user via account-delete (`POST /api/v1/account/delete` with
PDPA flow) cascades all per-user tables including credit_ledger,
manual_payments, user_flags, user_themes, and gifts sent by the user.
Gifts RECEIVED by the deleted user have `recipient_user_id` set to NULL
(SET NULL not CASCADE) so the sender's outgoing gift list keeps its
audit trail. The slip files at `slip_file_path` are NOT deleted by the
CASCADE — they'd become orphans on the volume. Acceptable for now; add
a cron sweeper if it grows.

## Index strategy

- `idx_users_line` on `line_user_id` — every webhook + LIFF auth call hits this
- `idx_users_stripe_customer` / `idx_users_omise_customer` — webhook reverse lookup
- `idx_food_logs_user_date` — Dashboard "today's logs" + summaries
- `idx_food_logs_logged_at` — recent activity feeds
- `idx_weight_logs_user_date` — chart range scans
- `idx_chat_messages_user_created` — recency window for context
- `idx_chat_messages_user_date` — daily quota counting
- `idx_subscriptions_provider_sub` UNIQUE — Stripe webhook idempotency
- `idx_payments_provider_charge` UNIQUE — Omise webhook idempotency
- `idx_payments_user_created` — payment history per user
- `idx_payments_status_expires` — pending charge cleanup queries
- `idx_admin_users_email` — login lookup
- `idx_manual_payments_user_created` — user submission history
- `idx_manual_payments_status_created` — operator FIFO pending list
- `idx_credit_ledger_user_created` — wallet history view (DESC)
- `idx_credit_ledger_source` — "show all ledger entries from payment #N"
- `idx_user_flags_user` — abuse history per user
- `idx_user_themes_user` — list themes owned by user
- `idx_gifts_claim_token` UNIQUE — public claim endpoint lookup
- `idx_gifts_sender_status` — sender's outgoing gift list
- `idx_gifts_recipient_status` — recipient's incoming gift list
- `idx_gifts_status_expires` — daily cron `expire_gifts` scan

## Conventions

- **Timestamps**: ISO 8601 UTC for `created_at`, `updated_at`, `logged_at`,
  `paid_at`, etc. Stored as TEXT (SQLite has no datetime type).
- **Local dates**: `food_logs.date` and `chat_messages.date` are precomputed
  in user TZ at insert. Format `YYYY-MM-DD` Bangkok local.
- **Money**: integers in subunits (`amount_satang` = THB × 100). Never float.
- **Booleans**: stored as `INTEGER` (0/1), hydrated to bool in repository.
- **Enums**: `CHECK` constraints enforce values. Add new values via new
  migration.

## Adding a migration

1. Open `backend/src/db/migrations.ts`
2. Append to the `migrations` array with name `NNNN_description.sql`
3. SQL goes in the `sql` string; supports multi-statement (semicolon-separated)
4. Migrations run in array order on boot, recorded in internal
   `_migrations` table

**No down migrations.** Forward-only. If you need to undo, write a new
migration that compensates.
