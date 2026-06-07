import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type { FoodLog, FoodLogTotals } from '../domain/types.js';

const FOOD_LOG_COLUMNS = `
  id, user_id, logged_at, date, meal_type,
  food_name_th, food_name_en, quantity_text,
  kcal, protein_g, carbs_g, fat_g,
  source, raw_text, confidence,
  created_at, updated_at
`;

type Stmts = {
  listByUserAndDate: Statement;
  totalsByUserAndDate: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    listByUserAndDate: db.prepare(
      `SELECT ${FOOD_LOG_COLUMNS}
       FROM food_logs
       WHERE user_id = ? AND date = ?
       ORDER BY logged_at ASC`
    ),
    totalsByUserAndDate: db.prepare(
      `SELECT
         COALESCE(SUM(kcal), 0)       AS kcal,
         COALESCE(SUM(protein_g), 0)  AS protein_g,
         COALESCE(SUM(carbs_g), 0)    AS carbs_g,
         COALESCE(SUM(fat_g), 0)      AS fat_g,
         COUNT(*)                     AS count
       FROM food_logs
       WHERE user_id = ? AND date = ?`
    ),
  };
  return _stmts;
};

export const foodLogsRepository = {
  listByUserAndDate: (userId: number, date: string): FoodLog[] => {
    return stmts().listByUserAndDate.all(userId, date) as FoodLog[];
  },

  totalsByUserAndDate: (userId: number, date: string): FoodLogTotals => {
    const row = stmts().totalsByUserAndDate.get(userId, date) as FoodLogTotals;
    return {
      kcal: Math.round(row.kcal),
      protein_g: Math.round(row.protein_g),
      carbs_g: Math.round(row.carbs_g),
      fat_g: Math.round(row.fat_g),
      count: row.count,
    };
  },
};
