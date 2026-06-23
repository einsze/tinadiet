import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type { UserFlag, UserFlagType } from '../domain/types.js';

const COLUMNS = `
  id, user_id, flag_type, reason, related_payment_id,
  flagged_by_admin_id, flagged_at, cleared_by_admin_id, cleared_at, clear_reason
`;

type Stmts = {
  insert: Statement;
  findById: Statement;
  listByUser: Statement;
  listActiveByUser: Statement;
  clearAllActiveByUser: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    insert: db.prepare(
      `INSERT INTO user_flags
         (user_id, flag_type, reason, related_payment_id, flagged_by_admin_id)
       VALUES (?, ?, ?, ?, ?)`
    ),
    findById: db.prepare(`SELECT ${COLUMNS} FROM user_flags WHERE id = ?`),
    listByUser: db.prepare(
      `SELECT ${COLUMNS} FROM user_flags
       WHERE user_id = ?
       ORDER BY flagged_at DESC`
    ),
    listActiveByUser: db.prepare(
      `SELECT ${COLUMNS} FROM user_flags
       WHERE user_id = ? AND cleared_at IS NULL
       ORDER BY flagged_at DESC`
    ),
    clearAllActiveByUser: db.prepare(
      `UPDATE user_flags
       SET cleared_by_admin_id = ?,
           cleared_at = datetime('now'),
           clear_reason = ?
       WHERE user_id = ? AND cleared_at IS NULL`
    ),
  };
  return _stmts;
};

export type UserFlagCreateInput = {
  user_id: number;
  flag_type: UserFlagType;
  reason: string | null;
  related_payment_id: number | null;
  flagged_by_admin_id: number;
};

export const userFlagsRepository = {
  create: (input: UserFlagCreateInput): UserFlag => {
    const info = stmts().insert.run(
      input.user_id,
      input.flag_type,
      input.reason,
      input.related_payment_id,
      input.flagged_by_admin_id
    );
    const id = Number(info.lastInsertRowid);
    const row = stmts().findById.get(id) as UserFlag | undefined;
    if (row === undefined) {
      throw new Error(`userFlagsRepository.create: row ${id} not found`);
    }
    return row;
  },

  listByUser: (userId: number): UserFlag[] => {
    return stmts().listByUser.all(userId) as UserFlag[];
  },

  listActiveByUser: (userId: number): UserFlag[] => {
    return stmts().listActiveByUser.all(userId) as UserFlag[];
  },

  clearAllActiveByUser: (
    userId: number,
    clearedByAdminId: number,
    reason: string
  ): number => {
    const info = stmts()
      .clearAllActiveByUser.run(clearedByAdminId, reason, userId);
    return info.changes;
  },
};
