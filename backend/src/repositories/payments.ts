import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type {
  Payment,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '../domain/types.js';

const PAYMENT_COLUMNS = `
  id, user_id, provider, provider_charge_id, provider_source_id,
  method, amount_satang, currency, status,
  failure_code, failure_message,
  authorize_uri, qr_image_uri,
  expires_at, completed_at,
  grant_days, grant_starts_at, grant_ends_at,
  last_event_type, last_event_at,
  created_at, updated_at
`;

type Stmts = {
  insert: Statement;
  findById: Statement;
  findByProviderChargeId: Statement;
  findLatestSuccessfulByUser: Statement;
  listByUser: Statement;
  updateStatus: Statement;
  markCompleted: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    insert: db.prepare(
      `INSERT INTO payments (
         user_id, provider, provider_charge_id, provider_source_id,
         method, amount_satang, currency, status,
         failure_code, failure_message,
         authorize_uri, qr_image_uri,
         expires_at,
         grant_days,
         last_event_type, last_event_at
       ) VALUES (
         @user_id, @provider, @provider_charge_id, @provider_source_id,
         @method, @amount_satang, @currency, @status,
         @failure_code, @failure_message,
         @authorize_uri, @qr_image_uri,
         @expires_at,
         @grant_days,
         @last_event_type, @last_event_at
       )`
    ),
    findById: db.prepare(
      `SELECT ${PAYMENT_COLUMNS} FROM payments WHERE id = ?`
    ),
    findByProviderChargeId: db.prepare(
      `SELECT ${PAYMENT_COLUMNS}
       FROM payments
       WHERE provider = ? AND provider_charge_id = ?`
    ),
    findLatestSuccessfulByUser: db.prepare(
      `SELECT ${PAYMENT_COLUMNS}
       FROM payments
       WHERE user_id = ? AND status = 'successful'
       ORDER BY completed_at DESC, id DESC
       LIMIT 1`
    ),
    listByUser: db.prepare(
      `SELECT ${PAYMENT_COLUMNS}
       FROM payments
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    ),
    updateStatus: db.prepare(
      `UPDATE payments SET
         status          = @status,
         failure_code    = @failure_code,
         failure_message = @failure_message,
         last_event_type = @last_event_type,
         last_event_at   = @last_event_at,
         updated_at      = datetime('now')
       WHERE provider = @provider AND provider_charge_id = @provider_charge_id`
    ),
    markCompleted: db.prepare(
      `UPDATE payments SET
         status          = 'successful',
         completed_at    = @completed_at,
         grant_starts_at = @grant_starts_at,
         grant_ends_at   = @grant_ends_at,
         last_event_type = @last_event_type,
         last_event_at   = @last_event_at,
         updated_at      = datetime('now')
       WHERE provider = @provider AND provider_charge_id = @provider_charge_id`
    ),
  };
  return _stmts;
};

export type CreatePaymentInput = {
  user_id: number;
  provider: PaymentProvider;
  provider_charge_id: string;
  provider_source_id: string | null;
  method: PaymentMethod;
  amount_satang: number;
  currency: string;
  status: PaymentStatus;
  failure_code: string | null;
  failure_message: string | null;
  authorize_uri: string | null;
  qr_image_uri: string | null;
  expires_at: string | null;
  grant_days: number;
  last_event_type: string | null;
  last_event_at: string | null;
};

export type UpdateStatusInput = {
  provider: PaymentProvider;
  provider_charge_id: string;
  status: PaymentStatus;
  failure_code: string | null;
  failure_message: string | null;
  last_event_type: string;
  last_event_at: string;
};

export type MarkCompletedInput = {
  provider: PaymentProvider;
  provider_charge_id: string;
  completed_at: string;
  grant_starts_at: string;
  grant_ends_at: string;
  last_event_type: string;
  last_event_at: string;
};

export const paymentsRepository = {
  create: (input: CreatePaymentInput): Payment => {
    const s = stmts();
    const info = s.insert.run(input);
    const id = Number(info.lastInsertRowid);
    const row = s.findById.get(id) as Payment | undefined;
    if (row === undefined) {
      throw new Error(
        `paymentsRepository.create: row ${id} not found after insert`
      );
    }
    return row;
  },

  findByProviderChargeId: (
    provider: PaymentProvider,
    providerChargeId: string
  ): Payment | undefined => {
    return stmts().findByProviderChargeId.get(provider, providerChargeId) as
      | Payment
      | undefined;
  },

  findLatestSuccessfulByUser: (userId: number): Payment | undefined => {
    return stmts().findLatestSuccessfulByUser.get(userId) as Payment | undefined;
  },

  listByUser: (userId: number, limit: number = 20): Payment[] => {
    return stmts().listByUser.all(userId, limit) as Payment[];
  },

  updateStatus: (input: UpdateStatusInput): Payment | undefined => {
    const s = stmts();
    s.updateStatus.run(input);
    return s.findByProviderChargeId.get(
      input.provider,
      input.provider_charge_id
    ) as Payment | undefined;
  },

  markCompleted: (input: MarkCompletedInput): Payment | undefined => {
    const s = stmts();
    s.markCompleted.run(input);
    return s.findByProviderChargeId.get(
      input.provider,
      input.provider_charge_id
    ) as Payment | undefined;
  },
};
