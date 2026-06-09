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
  kcal, kcal_low, kcal_high, protein_g, carbs_g, fat_g,
  source, raw_text, confidence,
  created_at, updated_at
`;

type Stmts = {
  listByUserAndDate: Statement;
  totalsByUserAndDate: Statement;
  insert: Statement;
  findById: Statement;
  deleteByIdAndUser: Statement;
  updateByIdAndUser: Statement;
  countPhotoLogsToday: Statement;
  weeklyAggregateByUser: Statement;
  distinctLogDatesRecent: Statement;
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
         kcal, kcal_low, kcal_high, protein_g, carbs_g, fat_g,
         source, raw_text, confidence
       ) VALUES (
         @user_id, @date, @meal_type,
         @food_name_th, @food_name_en, @quantity_text,
         @kcal, @kcal_low, @kcal_high, @protein_g, @carbs_g, @fat_g,
         @source, @raw_text, @confidence
       )`
    ),
    findById: db.prepare(
      `SELECT ${FOOD_LOG_COLUMNS} FROM food_logs WHERE id = ?`
    ),
    deleteByIdAndUser: db.prepare(
      `DELETE FROM food_logs WHERE id = ? AND user_id = ?`
    ),
    updateByIdAndUser: db.prepare(
      `UPDATE food_logs SET
         food_name_th  = @food_name_th,
         food_name_en  = @food_name_en,
         quantity_text = @quantity_text,
         meal_type     = @meal_type,
         kcal          = @kcal,
         kcal_low      = @kcal_low,
         kcal_high     = @kcal_high,
         protein_g     = @protein_g,
         carbs_g       = @carbs_g,
         fat_g         = @fat_g,
         updated_at    = datetime('now')
       WHERE id = @id AND user_id = @user_id`
    ),
    countPhotoLogsToday: db.prepare(
      `SELECT COUNT(*) AS count
       FROM food_logs
       WHERE user_id = ? AND date = ? AND source = 'photo'`
    ),
    weeklyAggregateByUser: db.prepare(
      `SELECT
         COALESCE(SUM(kcal), 0)       AS sum_kcal,
         COALESCE(SUM(protein_g), 0)  AS sum_protein_g,
         COALESCE(SUM(carbs_g), 0)    AS sum_carbs_g,
         COALESCE(SUM(fat_g), 0)      AS sum_fat_g,
         COUNT(*)                     AS log_count,
         COUNT(DISTINCT date)         AS days_logged
       FROM food_logs
       WHERE user_id = ? AND date >= ? AND date <= ?`
    ),
    distinctLogDatesRecent: db.prepare(
      `SELECT DISTINCT date
       FROM food_logs
       WHERE user_id = ? AND date <= ?
       ORDER BY date DESC
       LIMIT ?`
    ),
  };
  return _stmts;
};

export type FoodLogsWeeklyAggregate = {
  sum_kcal: number;
  sum_protein_g: number;
  sum_carbs_g: number;
  sum_fat_g: number;
  log_count: number;
  days_logged: number;
};

export type FoodLogUpdateInput = {
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text: string | null;
  meal_type: MealType | null;
  kcal: number;
  kcal_low: number;
  kcal_high: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type FoodLogCreateInput = {
  user_id: number;
  user_timezone: string;
  meal_type: MealType | null;
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text: string | null;
  kcal: number;
  kcal_low: number;
  kcal_high: number;
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

  deleteByIdAndUser: (id: number, userId: number): boolean => {
    const info = stmts().deleteByIdAndUser.run(id, userId);
    return info.changes > 0;
  },

  countPhotoLogsToday: (userId: number, date: string): number => {
    const row = stmts().countPhotoLogsToday.get(userId, date) as {
      count: number;
    };
    return row.count;
  },

  weeklyAggregate: (
    userId: number,
    startDate: string,
    endDate: string
  ): FoodLogsWeeklyAggregate => {
    const row = stmts().weeklyAggregateByUser.get(
      userId,
      startDate,
      endDate
    ) as FoodLogsWeeklyAggregate;
    return {
      sum_kcal: Math.round(row.sum_kcal),
      sum_protein_g: Math.round(row.sum_protein_g),
      sum_carbs_g: Math.round(row.sum_carbs_g),
      sum_fat_g: Math.round(row.sum_fat_g),
      log_count: row.log_count,
      days_logged: row.days_logged,
    };
  },

  distinctLogDatesRecent: (
    userId: number,
    upToDate: string,
    limit: number
  ): string[] => {
    const rows = stmts().distinctLogDatesRecent.all(
      userId,
      upToDate,
      limit
    ) as Array<{ date: string }>;
    return rows.map((r) => r.date);
  },

  updateByIdAndUser: (
    id: number,
    userId: number,
    input: FoodLogUpdateInput
  ): FoodLog | undefined => {
    const s = stmts();
    const info = s.updateByIdAndUser.run({
      id,
      user_id: userId,
      food_name_th: input.food_name_th,
      food_name_en: input.food_name_en,
      quantity_text: input.quantity_text,
      meal_type: input.meal_type,
      kcal: input.kcal,
      kcal_low: input.kcal_low,
      kcal_high: input.kcal_high,
      protein_g: input.protein_g,
      carbs_g: input.carbs_g,
      fat_g: input.fat_g,
    });
    if (info.changes === 0) return undefined;
    return s.findById.get(id) as FoodLog;
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
      kcal_low: input.kcal_low,
      kcal_high: input.kcal_high,
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
