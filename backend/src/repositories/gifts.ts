import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type {
  Gift,
  GiftRefusedReason,
  GiftStatus,
  GiftType,
} from '../domain/types.js';

const COLUMNS = `
  id, claim_token, sender_user_id, recipient_user_id,
  gift_type, payload, credit_spent_satang, message, status,
  claim_expires_at, claimed_at, canceled_at, expired_at,
  refused_at, refused_reason, revoked_at, revoked_by_admin_id, revoke_reason,
  applied_premium_ms_added, applied_theme_slug,
  created_at, updated_at
`;

type Stmts = {
  insert: Statement;
  findById: Statement;
  findByToken: Statement;
  listSent: Statement;
  listReceived: Statement;
  countPendingBySender: Statement;
  listAdmin: Statement;
  listAdminFiltered: Statement;
  countAdmin: Statement;
  countAdminFiltered: Statement;
  markClaimed: Statement;
  markCanceled: Statement;
  markExpired: Statement;
  markRefused: Statement;
  markRevoked: Statement;
  listExpiringPending: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    insert: db.prepare(
      `INSERT INTO gifts (
         claim_token, sender_user_id, gift_type, payload,
         credit_spent_satang, message, claim_expires_at
       ) VALUES (@claim_token, @sender_user_id, @gift_type, @payload,
                 @credit_spent_satang, @message, @claim_expires_at)`
    ),
    findById: db.prepare(`SELECT ${COLUMNS} FROM gifts WHERE id = ?`),
    findByToken: db.prepare(
      `SELECT ${COLUMNS} FROM gifts WHERE claim_token = ?`
    ),
    listSent: db.prepare(
      `SELECT ${COLUMNS} FROM gifts
       WHERE sender_user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ),
    listReceived: db.prepare(
      `SELECT ${COLUMNS} FROM gifts
       WHERE recipient_user_id = ? AND status = 'claimed'
       ORDER BY claimed_at DESC
       LIMIT ?`
    ),
    countPendingBySender: db.prepare(
      `SELECT COUNT(*) as n FROM gifts
       WHERE sender_user_id = ? AND status = 'pending'`
    ),
    listAdmin: db.prepare(
      `SELECT ${COLUMNS} FROM gifts
       ORDER BY created_at DESC
       LIMIT @limit OFFSET @offset`
    ),
    listAdminFiltered: db.prepare(
      `SELECT ${COLUMNS} FROM gifts
       WHERE (@status = '' OR status = @status)
       ORDER BY created_at DESC
       LIMIT @limit OFFSET @offset`
    ),
    countAdmin: db.prepare(`SELECT COUNT(*) AS c FROM gifts`),
    countAdminFiltered: db.prepare(
      `SELECT COUNT(*) AS c FROM gifts WHERE status = @status`
    ),
    markClaimed: db.prepare(
      `UPDATE gifts
       SET status = 'claimed',
           recipient_user_id = @recipient_user_id,
           claimed_at = datetime('now'),
           applied_premium_ms_added = @applied_premium_ms_added,
           applied_theme_slug = @applied_theme_slug,
           updated_at = datetime('now')
       WHERE id = @id AND status = 'pending'`
    ),
    markCanceled: db.prepare(
      `UPDATE gifts
       SET status = 'canceled',
           canceled_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ? AND status = 'pending' AND sender_user_id = ?`
    ),
    markExpired: db.prepare(
      `UPDATE gifts
       SET status = 'expired',
           expired_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ? AND status = 'pending'`
    ),
    markRefused: db.prepare(
      `UPDATE gifts
       SET status = 'refused',
           refused_at = datetime('now'),
           refused_reason = @refused_reason,
           updated_at = datetime('now')
       WHERE id = @id AND status = 'pending'`
    ),
    markRevoked: db.prepare(
      `UPDATE gifts
       SET status = 'revoked',
           revoked_at = datetime('now'),
           revoked_by_admin_id = @revoked_by_admin_id,
           revoke_reason = @revoke_reason,
           updated_at = datetime('now')
       WHERE id = @id AND status = 'claimed'`
    ),
    listExpiringPending: db.prepare(
      `SELECT ${COLUMNS} FROM gifts
       WHERE status = 'pending' AND claim_expires_at < ?
       ORDER BY claim_expires_at ASC`
    ),
  };
  return _stmts;
};

export type CreateGiftInput = {
  claim_token: string;
  sender_user_id: number;
  gift_type: GiftType;
  payload: string;
  credit_spent_satang: number;
  message: string | null;
  claim_expires_at: string;
};

export const giftsRepository = {
  create: (input: CreateGiftInput): Gift => {
    const info = stmts().insert.run(input);
    const id = Number(info.lastInsertRowid);
    const row = stmts().findById.get(id) as Gift | undefined;
    if (row === undefined) {
      throw new Error(`giftsRepository.create: gift ${id} not found after insert`);
    }
    return row;
  },

  findById: (id: number): Gift | undefined => {
    return stmts().findById.get(id) as Gift | undefined;
  },

  findByToken: (token: string): Gift | undefined => {
    return stmts().findByToken.get(token) as Gift | undefined;
  },

  listSent: (senderUserId: number, limit = 50): Gift[] => {
    return stmts().listSent.all(senderUserId, limit) as Gift[];
  },

  listReceived: (recipientUserId: number, limit = 50): Gift[] => {
    return stmts().listReceived.all(recipientUserId, limit) as Gift[];
  },

  countPendingBySender: (senderUserId: number): number => {
    const row = stmts().countPendingBySender.get(senderUserId) as { n: number };
    return row.n;
  },

  markClaimed: (input: {
    id: number;
    recipient_user_id: number;
    applied_premium_ms_added: number | null;
    applied_theme_slug: string | null;
  }): boolean => {
    const info = stmts().markClaimed.run(input);
    return info.changes > 0;
  },

  markCanceled: (id: number, senderUserId: number): boolean => {
    const info = stmts().markCanceled.run(id, senderUserId);
    return info.changes > 0;
  },

  markExpired: (id: number): boolean => {
    const info = stmts().markExpired.run(id);
    return info.changes > 0;
  },

  markRefused: (id: number, reason: GiftRefusedReason): boolean => {
    const info = stmts().markRefused.run({ id, refused_reason: reason });
    return info.changes > 0;
  },

  markRevoked: (input: {
    id: number;
    revoked_by_admin_id: number;
    revoke_reason: string;
  }): boolean => {
    const info = stmts().markRevoked.run(input);
    return info.changes > 0;
  },

  listExpiringPending: (nowIso: string): Gift[] => {
    return stmts().listExpiringPending.all(nowIso) as Gift[];
  },

  listAdmin: (
    status: GiftStatus | '',
    limit: number,
    offset: number
  ): Gift[] => {
    if (status === '') {
      return stmts().listAdmin.all({ limit, offset }) as Gift[];
    }
    return stmts().listAdminFiltered.all({
      status,
      limit,
      offset,
    }) as Gift[];
  },

  countAdmin: (status: GiftStatus | ''): number => {
    if (status === '') {
      const row = stmts().countAdmin.get() as { c: number };
      return row.c;
    }
    const row = stmts().countAdminFiltered.get({ status }) as { c: number };
    return row.c;
  },
};
