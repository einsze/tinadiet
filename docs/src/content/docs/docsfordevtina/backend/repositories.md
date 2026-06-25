---
title: Repositories
description: The lazy stmts pattern and how to add a new repository.
sidebar:
  order: 2
---

Repositories wrap `db` (better-sqlite3) and expose typed operations. **All
prepared statements must be lazy-initialized** to avoid ESM hoisting
hazards.

## The lazy stmts pattern

Template every repository follows:

```ts
import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type { Foo } from '../domain/types.js';

const FOO_COLUMNS = `
  id, user_id, name, created_at, updated_at
`;

type Stmts = {
  findById: Statement;
  insert: Statement;
  findByUserId: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    findById: db.prepare(`SELECT ${FOO_COLUMNS} FROM foos WHERE id = ?`),
    insert: db.prepare(
      `INSERT INTO foos (user_id, name) VALUES (@user_id, @name)`
    ),
    findByUserId: db.prepare(
      `SELECT ${FOO_COLUMNS} FROM foos WHERE user_id = ? ORDER BY id DESC`
    ),
  };
  return _stmts;
};

export const fooRepository = {
  findById: (id: number): Foo | undefined => {
    return stmts().findById.get(id) as Foo | undefined;
  },

  create: (input: { user_id: number; name: string }): Foo => {
    const info = stmts().insert.run(input);
    const id = Number(info.lastInsertRowid);
    const row = stmts().findById.get(id) as Foo | undefined;
    if (row === undefined) {
      throw new Error(`fooRepository.create: row ${id} not found after insert`);
    }
    return row;
  },

  listByUser: (userId: number): Foo[] => {
    return stmts().findByUserId.all(userId) as Foo[];
  },
};
```

**Why lazy?** Read [Key invariants — Rule 1](/docsfordevtina/architecture/key-invariants/#1-lazy-init-prepared-statements).

## Hydration (boolean from INTEGER)

SQLite has no boolean type; we store `0` / `1`. When a domain type has a
boolean field, hydrate on read:

```ts
type RawSubscription = Omit<Subscription, 'cancel_at_period_end'> & {
  cancel_at_period_end: number;
};

const hydrate = (row: RawSubscription): Subscription => ({
  ...row,
  cancel_at_period_end: row.cancel_at_period_end === 1,
});

// In repository methods:
const row = stmts().findById.get(id) as RawSubscription | undefined;
return row !== undefined ? hydrate(row) : undefined;
```

When inserting, convert back:

```ts
const params = {
  ...input,
  cancel_at_period_end: input.cancel_at_period_end ? 1 : 0,
};
```

## Upsert pattern

For webhook idempotency we use UPDATE-then-INSERT-if-no-rows:

```ts
upsertByProviderSubscriptionId: db.prepare(
  `UPDATE subscriptions SET status = @status, ... WHERE provider = @provider AND provider_subscription_id = @provider_subscription_id`
),

// in method:
const updateInfo = s.upsertByProviderSubscriptionId.run(params);
if (updateInfo.changes === 0) {
  s.insert.run(params);
}
```

The `(provider, provider_subscription_id)` UNIQUE index ensures this is
race-safe — concurrent INSERT would fail.

## Patterns across repos

| Pattern | Where used | Why |
|---|---|---|
| `find*` returns `T \| undefined` | All | Caller must handle missing |
| `list*` returns `T[]` | All | Empty array, not undefined |
| `create` returns full hydrated row | All | Caller often needs `id` + defaults |
| `update*` returns updated row or undefined | All | `id` may not exist |
| `delete*` returns boolean (rows affected > 0) | All | Caller can detect "not found" |

## Existing repositories

User-data repos (CASCADE deleted with user):

- **`users.ts`** — Profile, plan, premium expiry, credit balance, theme,
  support mode. Includes `applyPremium` / `revertToFree` /
  `listExpiredPremium` / `revertAllExpired`, `listExpiringOnLocalDate`
  (renewal cron), `syncWeightChange` (weight + recompute goals
  atomically), `setActiveTheme`, `setSupportMode` / `clearSupportMode`,
  `updateCreditBalance` (used by `credit.ts` only — direct calls
  forbidden), abuse + block setters.
- **`food_logs.ts`** — CRUD + aggregate queries (`listByUserAndDate`,
  `totalsByUserAndDate`, `weeklyAggregate`, `countPhotoLogsToday`,
  `distinctLogDatesRecent`).
- **`weight_logs.ts`** — Time series, `latest`, `listRecent`,
  `findByUserAndDate` (used by history endpoint).
- **`chat_messages.ts`** — Append + window queries
  (`listRecentWindow(userId, minutes, limit)`, `countQuestionsToday`,
  `listRecent` for LIFF chat panel).

Payment + audit repos:

- **`subscriptions.ts`** — Stripe upsert + lookup. Dormant.
- **`payments.ts`** — Omise charges. `create`, `findByProviderChargeId`,
  `updateStatus`, `markCompleted` (writes grant window). Dormant pending
  KYC.
- **`manual_payments.ts`** — Top-up lifecycle (Sprint 6 M4). Listing for
  operator FIFO pending queue, status filter for history,
  `setApproved` / `setRejected` / `setRevoked` setters.
- **`credit_ledger.ts`** — Append-only ledger (Sprint 6 M4). Insert is
  done ONLY via `services/credit.ts`. List by user (paginated), list by
  source_ref_id.
- **`user_flags.ts`** — Abuse audit log (Sprint 6 M4). One row per flag
  event, `cleared_at` set on clear.
- **`admin_users.ts`** — Admin login + CRUD (Sprint 6 M4). bcrypt-hashed
  passwords, last_login_at audit.
- **`system_settings.ts`** — Key-value table with `getAll` /
  `getByKeys` / `set(key, value, adminUserId)` (audit-trailed).

Marketplace repos:

- **`user_themes.ts`** — Per-user theme ownership (Sprint 6 M5).
  `purchase` records the price snapshot at purchase time;
  `listByUser` for LIFF "owned themes", `existsForUser` for gift
  refused-reason check.
- **`gifts.ts`** — Gift lifecycle (Sprint 6 M6). Status transitions via
  named setters (`markClaimed` / `markCanceled` / `markExpired` / etc.),
  `findByClaimToken` for public claim preview, `listPendingExpired` for
  daily cron.

## Adding a new repository

1. Create file `backend/src/repositories/<name>.ts`
2. Define `Stmts` type and `_stmts` + `stmts()` getter
3. Add columns constant
4. Define `<name>Repository` object with methods
5. Add hydrate helper if any boolean fields
6. Import where needed (services, routes, jobs)

Don't add a `BaseRepository` parent class or generic helper. The duplication
across files is intentional — it makes each repo self-contained and
introspectable, and the lazy stmts pattern resists abstraction without
ceremony.
