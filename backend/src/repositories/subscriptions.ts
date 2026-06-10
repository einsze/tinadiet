import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type {
  Subscription,
  SubscriptionProvider,
  SubscriptionStatus,
} from '../domain/types.js';

const SUBSCRIPTION_COLUMNS = `
  id, user_id, provider, provider_subscription_id, provider_customer_id,
  status, current_period_start, current_period_end,
  cancel_at_period_end, canceled_at,
  last_event_type, last_event_at,
  created_at, updated_at
`;

type Stmts = {
  insert: Statement;
  findById: Statement;
  findByProviderSubscriptionId: Statement;
  findLatestByUser: Statement;
  upsertByProviderSubscriptionId: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    insert: db.prepare(
      `INSERT INTO subscriptions (
         user_id, provider, provider_subscription_id, provider_customer_id,
         status, current_period_start, current_period_end,
         cancel_at_period_end, canceled_at,
         last_event_type, last_event_at
       ) VALUES (
         @user_id, @provider, @provider_subscription_id, @provider_customer_id,
         @status, @current_period_start, @current_period_end,
         @cancel_at_period_end, @canceled_at,
         @last_event_type, @last_event_at
       )`
    ),
    findById: db.prepare(
      `SELECT ${SUBSCRIPTION_COLUMNS} FROM subscriptions WHERE id = ?`
    ),
    findByProviderSubscriptionId: db.prepare(
      `SELECT ${SUBSCRIPTION_COLUMNS}
       FROM subscriptions
       WHERE provider = ? AND provider_subscription_id = ?`
    ),
    findLatestByUser: db.prepare(
      `SELECT ${SUBSCRIPTION_COLUMNS}
       FROM subscriptions
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    ),
    upsertByProviderSubscriptionId: db.prepare(
      `UPDATE subscriptions SET
         status                 = @status,
         current_period_start   = @current_period_start,
         current_period_end     = @current_period_end,
         cancel_at_period_end   = @cancel_at_period_end,
         canceled_at            = @canceled_at,
         last_event_type        = @last_event_type,
         last_event_at          = @last_event_at,
         updated_at             = datetime('now')
       WHERE provider = @provider AND provider_subscription_id = @provider_subscription_id`
    ),
  };
  return _stmts;
};

type RawSubscription = Omit<Subscription, 'cancel_at_period_end'> & {
  cancel_at_period_end: number;
};

const hydrate = (row: RawSubscription): Subscription => ({
  ...row,
  cancel_at_period_end: row.cancel_at_period_end === 1,
});

export type SubscriptionUpsertInput = {
  user_id: number;
  provider: SubscriptionProvider;
  provider_subscription_id: string;
  provider_customer_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
};

export const subscriptionsRepository = {
  findByProviderSubscriptionId: (
    provider: SubscriptionProvider,
    providerSubscriptionId: string
  ): Subscription | undefined => {
    const row = stmts().findByProviderSubscriptionId.get(
      provider,
      providerSubscriptionId
    ) as RawSubscription | undefined;
    return row !== undefined ? hydrate(row) : undefined;
  },

  findLatestByUser: (userId: number): Subscription | undefined => {
    const row = stmts().findLatestByUser.get(userId) as
      | RawSubscription
      | undefined;
    return row !== undefined ? hydrate(row) : undefined;
  },

  upsert: (input: SubscriptionUpsertInput): Subscription => {
    const s = stmts();
    const params = {
      user_id: input.user_id,
      provider: input.provider,
      provider_subscription_id: input.provider_subscription_id,
      provider_customer_id: input.provider_customer_id,
      status: input.status,
      current_period_start: input.current_period_start,
      current_period_end: input.current_period_end,
      cancel_at_period_end: input.cancel_at_period_end ? 1 : 0,
      canceled_at: input.canceled_at,
      last_event_type: input.last_event_type,
      last_event_at: input.last_event_at,
    };
    const updateInfo = s.upsertByProviderSubscriptionId.run(params);
    if (updateInfo.changes === 0) {
      const insertInfo = s.insert.run(params);
      const id = Number(insertInfo.lastInsertRowid);
      const row = s.findById.get(id) as RawSubscription | undefined;
      if (row === undefined) {
        throw new Error(
          `subscriptionsRepository.upsert: row ${id} not found after insert`
        );
      }
      return hydrate(row);
    }
    const row = s.findByProviderSubscriptionId.get(
      input.provider,
      input.provider_subscription_id
    ) as RawSubscription | undefined;
    if (row === undefined) {
      throw new Error(
        `subscriptionsRepository.upsert: row not found after update`
      );
    }
    return hydrate(row);
  },
};
