import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import { todayInTimezone } from '../domain/date.js';
import type { WeightLog, WeightLogSource } from '../domain/types.js';

const WEIGHT_LOG_COLUMNS = `
  id, user_id, logged_at, date, weight_kg, note, source, created_at
`;

type Stmts = {
  insert: Statement;
  findById: Statement;
  listRecent: Statement;
  latest: Statement;
  findByUserAndDate: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    insert: db.prepare(
      `INSERT INTO weight_logs (user_id, date, weight_kg, note, source)
       VALUES (@user_id, @date, @weight_kg, @note, @source)`
    ),
    findById: db.prepare(
      `SELECT ${WEIGHT_LOG_COLUMNS} FROM weight_logs WHERE id = ?`
    ),
    listRecent: db.prepare(
      `SELECT ${WEIGHT_LOG_COLUMNS}
       FROM weight_logs
       WHERE user_id = ?
       ORDER BY logged_at DESC
       LIMIT ?`
    ),
    latest: db.prepare(
      `SELECT ${WEIGHT_LOG_COLUMNS}
       FROM weight_logs
       WHERE user_id = ?
       ORDER BY logged_at DESC
       LIMIT 1`
    ),
    findByUserAndDate: db.prepare(
      `SELECT ${WEIGHT_LOG_COLUMNS}
       FROM weight_logs
       WHERE user_id = ? AND date = ?
       ORDER BY logged_at DESC
       LIMIT 1`
    ),
  };
  return _stmts;
};

export type WeightLogCreateInput = {
  user_id: number;
  user_timezone: string;
  weight_kg: number;
  note: string | null;
  source: WeightLogSource;
};

export const weightLogsRepository = {
  listRecent: (userId: number, limit: number = 30): WeightLog[] => {
    return stmts().listRecent.all(userId, limit) as WeightLog[];
  },

  latest: (userId: number): WeightLog | undefined => {
    return stmts().latest.get(userId) as WeightLog | undefined;
  },

  findByUserAndDate: (
    userId: number,
    date: string
  ): WeightLog | undefined => {
    return stmts().findByUserAndDate.get(userId, date) as WeightLog | undefined;
  },

  create: (input: WeightLogCreateInput): WeightLog => {
    const s = stmts();
    const date = todayInTimezone(input.user_timezone);
    const info = s.insert.run({
      user_id: input.user_id,
      date,
      weight_kg: input.weight_kg,
      note: input.note,
      source: input.source,
    });
    const id = Number(info.lastInsertRowid);
    const row = s.findById.get(id) as WeightLog | undefined;
    if (row === undefined) {
      throw new Error(`weightLogsRepository.create: row ${id} not found`);
    }
    return row;
  },
};
