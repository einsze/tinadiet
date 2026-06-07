import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type {
  FoodLog,
  FoodLogSource,
  FoodLogTotals,
  MealType,
} from '../domain/types.js';
import { todayInTimezone } from '../domain/date.js';

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
  insert: Statement;
  findById: Statement;
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
    insert: db.prepare(
      `INSERT INTO food_logs (
         user_id, date, meal_type,
         food_name_th, food_name_en, quantity_text,
         kcal, protein_g, carbs_g, fat_g,
         source, raw_text, confidence
       ) VALUES (
         @user_id, @date, @meal_type,
         @food_name_th, @food_name_en, @quantity_text,
         @kcal, @protein_g, @carbs_g, @fat_g,
         @source, @raw_text, @confidence
       )`
    ),
    findById: db.prepare(
      `SELECT ${FOOD_LOG_COLUMNS} FROM food_logs WHERE id = ?`
    ),
  };
  return _stmts;
};

export type FoodLogCreateInput = {
  user_id: number;
  user_timezone: string;
  meal_type: MealType | null;
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: FoodLogSource;
  raw_text: string | null;
  confidence: number | null;
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

  create: (input: FoodLogCreateInput): FoodLog => {
    const s = stmts();
    const date = todayInTimezone(input.user_timezone);
    const info = s.insert.run({
      user_id: input.user_id,
      date,
      meal_type: input.meal_type,
      food_name_th: input.food_name_th,
      food_name_en: input.food_name_en,
      quantity_text: input.quantity_text,
      kcal: input.kcal,
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
      source: input.source,
      raw_text: input.raw_text,
      confidence: input.confidence,
    });
    const id = Number(info.lastInsertRowid);
    const created = s.findById.get(id) as FoodLog | undefined;
    if (created === undefined) {
      throw new Error(`foodLogsRepository.create: row ${id} not found after insert`);
    }
    return created;
  },
};
