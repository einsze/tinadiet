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

**Why lazy?** Read [Key invariants — Rule 1](/documentation/architecture/key-invariants/#1-lazy-init-prepared-statements).

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

- **`users.ts`** — Profile, plan, premium expiry, manual SQL `applyPremium` /
  `revertToFree` / `listExpiredPremium` / `revertAllExpired`. Special method
  `syncWeightChange` updates weight + recomputes goals atomically.
- **`food_logs.ts`** — CRUD + aggregate queries (`weeklyAggregate`,
  `countPhotoLogsToday`, `distinctLogDatesRecent`).
- **`weight_logs.ts`** — Time series, `latest`, `listRecent`.
- **`chat_messages.ts`** — Append + window queries
  (`listRecentWindow(userId, minutes, limit)`, `countQuestionsToday`).
- **`subscriptions.ts`** — Stripe upsert + lookup. Dormant.
- **`payments.ts`** — Omise charges. `create`, `findByProviderChargeId`,
  `updateStatus`, `markCompleted` (which writes grant window).

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
