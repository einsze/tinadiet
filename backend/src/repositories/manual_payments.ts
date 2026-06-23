import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type {
  ManualPayment,
  ManualPaymentStatus,
} from '../domain/types.js';

const COLUMNS = `
  id, user_id, requested_amount_satang, actual_amount_satang,
  slip_file_path, slip_mime_type, slip_size_bytes,
  status, reviewed_by_admin_id, reviewed_at, rejection_reason, admin_notes,
  flag_user_as_abuse, credit_granted_satang,
  revoked_by_admin_id, revoked_at, revoke_reason,
  created_at, updated_at
`;

type Stmts = {
  findById: Statement;
  insert: Statement;
  attachSlip: Statement;
  listByUserRecent: Statement;
  listPending: Statement;
  listHistory: Statement;
  countByUserAndStatus: Statement;
  markReviewed: Statement;
  markRevoked: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    findById: db.prepare(`SELECT ${COLUMNS} FROM manual_payments WHERE id = ?`),
    insert: db.prepare(
      `INSERT INTO manual_payments (user_id, requested_amount_satang, status)
       VALUES (?, ?, 'awaiting_slip')`
    ),
    attachSlip: db.prepare(
      `UPDATE manual_payments
       SET slip_file_path = ?,
           slip_mime_type = ?,
           slip_size_bytes = ?,
           status = 'pending',
           updated_at = datetime('now')
       WHERE id = ? AND status = 'awaiting_slip'`
    ),
    listByUserRecent: db.prepare(
      `SELECT ${COLUMNS} FROM manual_payments
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ),
    listPending: db.prepare(
      `SELECT ${COLUMNS} FROM manual_payments
       WHERE status IN ('pending', 'flagged_review')
       ORDER BY created_at ASC
       LIMIT ? OFFSET ?`
    ),
    listHistory: db.prepare(
      `SELECT ${COLUMNS} FROM manual_payments
       WHERE status NOT IN ('awaiting_slip', 'pending', 'flagged_review')
         AND (@userId IS NULL OR user_id = @userId)
         AND (@status = '' OR status = @status)
       ORDER BY reviewed_at DESC
       LIMIT @limit OFFSET @offset`
    ),
    countByUserAndStatus: db.prepare(
      `SELECT COUNT(*) AS c FROM manual_payments
       WHERE user_id = ? AND status = ?`
    ),
    markReviewed: db.prepare(
      `UPDATE manual_payments
       SET status = @status,
           reviewed_by_admin_id = @admin_id,
           reviewed_at = datetime('now'),
           actual_amount_satang = @actual_amount_satang,
           credit_granted_satang = @credit_granted_satang,
           rejection_reason = @rejection_reason,
           admin_notes = @admin_notes,
           flag_user_as_abuse = @flag_user_as_abuse,
           updated_at = datetime('now')
       WHERE id = @id AND status IN ('pending', 'flagged_review')`
    ),
    markRevoked: db.prepare(
      `UPDATE manual_payments
       SET status = 'revoked',
           revoked_by_admin_id = ?,
           revoked_at = datetime('now'),
           revoke_reason = ?,
           updated_at = datetime('now')
       WHERE id = ? AND status = 'approved'`
    ),
  };
  return _stmts;
};

type RawManualPayment = Omit<ManualPayment, 'flag_user_as_abuse'> & {
  flag_user_as_abuse: number;
};

const hydrate = (
  row: RawManualPayment | undefined
): ManualPayment | undefined => {
  if (row === undefined) return undefined;
  return { ...row, flag_user_as_abuse: row.flag_user_as_abuse === 1 };
};

const hydrateAll = (rows: RawManualPayment[]): ManualPayment[] =>
  rows.map((r) => hydrate(r) as ManualPayment);

export type ManualPaymentReviewInput = {
  id: number;
  status: 'approved' | 'rejected' | 'flagged_review';
  admin_id: number;
  actual_amount_satang: number | null;
  credit_granted_satang: number | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  flag_user_as_abuse: boolean;
};

export const manualPaymentsRepository = {
  findById: (id: number): ManualPayment | undefined => {
    return hydrate(
      stmts().findById.get(id) as RawManualPayment | undefined
    );
  },

  createAwaitingSlip: (
    userId: number,
    requestedAmountSatang: number
  ): ManualPayment => {
    const info = stmts().insert.run(userId, requestedAmountSatang);
    const id = Number(info.lastInsertRowid);
    const row = stmts().findById.get(id) as RawManualPayment | undefined;
    if (row === undefined) {
      throw new Error(`manualPaymentsRepository.create: row ${id} not found`);
    }
    return hydrate(row) as ManualPayment;
  },

  attachSlip: (
    id: number,
    slipFilePath: string,
    slipMimeType: string,
    slipSizeBytes: number
  ): ManualPayment | undefined => {
    const info = stmts().attachSlip.run(
      slipFilePath,
      slipMimeType,
      slipSizeBytes,
      id
    );
    if (info.changes === 0) return undefined;
    return hydrate(stmts().findById.get(id) as RawManualPayment | undefined);
  },

  listByUserRecent: (userId: number, limit: number): ManualPayment[] => {
    const rows = stmts().listByUserRecent.all(userId, limit) as RawManualPayment[];
    return hydrateAll(rows);
  },

  listPending: (limit: number, offset: number): ManualPayment[] => {
    const rows = stmts().listPending.all(limit, offset) as RawManualPayment[];
    return hydrateAll(rows);
  },

  listHistory: (input: {
    userId: number | null;
    status: ManualPaymentStatus | '';
    limit: number;
    offset: number;
  }): ManualPayment[] => {
    const rows = stmts().listHistory.all({
      userId: input.userId,
      status: input.status,
      limit: input.limit,
      offset: input.offset,
    }) as RawManualPayment[];
    return hydrateAll(rows);
  },

  countByUserAndStatus: (
    userId: number,
    status: ManualPaymentStatus
  ): number => {
    const row = stmts().countByUserAndStatus.get(userId, status) as { c: number };
    return row.c;
  },

  markReviewed: (input: ManualPaymentReviewInput): ManualPayment | undefined => {
    const info = stmts().markReviewed.run({
      id: input.id,
      status: input.status,
      admin_id: input.admin_id,
      actual_amount_satang: input.actual_amount_satang,
      credit_granted_satang: input.credit_granted_satang,
      rejection_reason: input.rejection_reason,
      admin_notes: input.admin_notes,
      flag_user_as_abuse: input.flag_user_as_abuse ? 1 : 0,
    });
    if (info.changes === 0) return undefined;
    return hydrate(
      stmts().findById.get(input.id) as RawManualPayment | undefined
    );
  },

  markRevoked: (
    id: number,
    revokedByAdminId: number,
    revokeReason: string
  ): ManualPayment | undefined => {
    const info = stmts().markRevoked.run(revokedByAdminId, revokeReason, id);
    if (info.changes === 0) return undefined;
    return hydrate(stmts().findById.get(id) as RawManualPayment | undefined);
  },
};
