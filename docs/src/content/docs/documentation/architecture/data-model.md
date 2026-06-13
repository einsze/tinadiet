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
Primary aggregate. Tracks identity, profile, computed goals, and plan.

```sql
CREATE TABLE users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id        TEXT NOT NULL UNIQUE,
  display_name        TEXT,
  gender              TEXT CHECK(gender IN ('male','female','other')),
  date_of_birth       TEXT,
  height_cm           REAL,
  current_weight_kg   REAL,
  target_weight_kg    REAL,
  activity_level      TEXT CHECK(activity_level IN
                        ('sedentary','light','moderate','active','very_active')),
  goal_type           TEXT CHECK(goal_type IN ('loss','maintain','gain')),
  bmr_kcal            REAL,
  tdee_kcal           REAL,
  daily_calorie_goal  REAL,
  daily_protein_g     REAL,
  daily_carbs_g       REAL,
  daily_fat_g         REAL,
  locale              TEXT NOT NULL DEFAULT 'th-TH',
  timezone            TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  plan                TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','premium')),
  premium_expires_at  TEXT,
  stripe_customer_id  TEXT,
  omise_customer_id   TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Notes**
- `daily_calorie_goal IS NOT NULL` is the canonical "profile complete" check.
  See `domain/profile.ts` `isProfileComplete()`.
- `plan='premium' AND premium_expires_at > now` is the canonical "is
  premium" check. See `domain/profile.ts` `isPremium()`.
- `stripe_customer_id` reserved for future use; Stripe code is dormant.

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
dormant** since payment pivoted to Omise.

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

## Relationships

```
users (id)
  │
  ├── food_logs.user_id      (ON DELETE CASCADE)
  ├── weight_logs.user_id    (ON DELETE CASCADE)
  ├── chat_messages.user_id  (ON DELETE CASCADE)
  ├── subscriptions.user_id  (ON DELETE CASCADE)
  └── payments.user_id       (ON DELETE CASCADE)
```

Deleting a user via account-delete (`POST /api/v1/account/delete` with
PDPA flow) cascades everything. See
`routes/api/account.ts`.

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
