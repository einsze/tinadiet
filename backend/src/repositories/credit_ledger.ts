import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type {
  CreditLedgerEntry,
  CreditLedgerSourceType,
} from '../domain/types.js';

const COLUMNS = `
  id, user_id, amount_satang, balance_after_satang,
  source_type, source_ref_id, admin_user_id, note, created_at
`;

type Stmts = {
  insert: Statement;
  findById: Statement;
  listByUserRecent: Statement;
  listByUserPaginated: Statement;
  countByUser: Statement;
  findBySourceRef: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    insert: db.prepare(
      `INSERT INTO credit_ledger
        (user_id, amount_satang, balance_after_satang,
         source_type, source_ref_id, admin_user_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ),
    findById: db.prepare(`SELECT ${COLUMNS} FROM credit_ledger WHERE id = ?`),
    listByUserRecent: db.prepare(
      `SELECT ${COLUMNS} FROM credit_ledger
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    ),
    listByUserPaginated: db.prepare(
      `SELECT ${COLUMNS} FROM credit_ledger
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    ),
    countByUser: db.prepare(
      `SELECT COUNT(*) AS c FROM credit_ledger WHERE user_id = ?`
    ),
    findBySourceRef: db.prepare(
      `SELECT ${COLUMNS} FROM credit_ledger
       WHERE source_type = ? AND source_ref_id = ?
       ORDER BY id ASC`
    ),
  };
  return _stmts;
};

export type CreditLedgerCreateInput = {
  user_id: number;
  amount_satang: number;
  balance_after_satang: number;
  source_type: CreditLedgerSourceType;
  source_ref_id: number | null;
  admin_user_id: number | null;
  note: string | null;
};

export const creditLedgerRepository = {
  create: (input: CreditLedgerCreateInput): CreditLedgerEntry => {
    const info = stmts().insert.run(
      input.user_id,
      input.amount_satang,
      input.balance_after_satang,
      input.source_type,
      input.source_ref_id,
      input.admin_user_id,
      input.note
    );
    const id = Number(info.lastInsertRowid);
    const row = stmts().findById.get(id) as CreditLedgerEntry | undefined;
    if (row === undefined) {
      throw new Error(`creditLedgerRepository.create: row ${id} not found`);
    }
    return row;
  },

  listByUserRecent: (userId: number, limit: number): CreditLedgerEntry[] => {
    return stmts().listByUserRecent.all(userId, limit) as CreditLedgerEntry[];
  },

  listByUserPaginated: (
    userId: number,
    limit: number,
    offset: number
  ): CreditLedgerEntry[] => {
    return stmts().listByUserPaginated.all(
      userId,
      limit,
      offset
    ) as CreditLedgerEntry[];
  },

  countByUser: (userId: number): number => {
    const row = stmts().countByUser.get(userId) as { c: number };
    return row.c;
  },

  findBySourceRef: (
    sourceType: CreditLedgerSourceType,
    sourceRefId: number
  ): CreditLedgerEntry[] => {
    return stmts().findBySourceRef.all(
      sourceType,
      sourceRefId
    ) as CreditLedgerEntry[];
  },
};
