import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import { calculateNutritionGoals } from '../domain/nutrition.js';
import type { ProfileInput, User } from '../domain/types.js';

const USER_COLUMNS = `
  id, line_user_id, display_name,
  gender, date_of_birth, height_cm,
  current_weight_kg, target_weight_kg,
  activity_level, goal_type,
  bmr_kcal, tdee_kcal, daily_calorie_goal,
  daily_protein_g, daily_carbs_g, daily_fat_g,
  locale, timezone,
  created_at, updated_at
`;

type Stmts = {
  findByLine: Statement;
  findById: Statement;
  insert: Statement;
  updateDisplayName: Statement;
  updateProfile: Statement;
  updateCurrentWeight: Statement;
  listProfileCompleted: Statement;
};

let _stmts: Stmts | null = null;

const stmts = (): Stmts => {
  if (_stmts !== null) return _stmts;
  _stmts = {
    findByLine: db.prepare(
      `SELECT ${USER_COLUMNS} FROM users WHERE line_user_id = ?`
    ),
    findById: db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`),
    insert: db.prepare(
      `INSERT INTO users (line_user_id, display_name) VALUES (?, ?)`
    ),
    updateDisplayName: db.prepare(
      `UPDATE users
       SET display_name = ?, updated_at = datetime('now')
       WHERE id = ? AND (display_name IS NULL OR display_name != ?)`
    ),
    updateProfile: db.prepare(
      `UPDATE users SET
         gender             = @gender,
         date_of_birth      = @date_of_birth,
         height_cm          = @height_cm,
         current_weight_kg  = @current_weight_kg,
         target_weight_kg   = @target_weight_kg,
         activity_level     = @activity_level,
         goal_type          = @goal_type,
         bmr_kcal           = @bmr_kcal,
         tdee_kcal          = @tdee_kcal,
         daily_calorie_goal = @daily_calorie_goal,
         daily_protein_g    = @daily_protein_g,
         daily_carbs_g      = @daily_carbs_g,
         daily_fat_g        = @daily_fat_g,
         updated_at         = datetime('now')
       WHERE id = @id`
    ),
    listProfileCompleted: db.prepare(
      `SELECT ${USER_COLUMNS}
       FROM users
       WHERE daily_calorie_goal IS NOT NULL
       ORDER BY id ASC`
    ),
    updateCurrentWeight: db.prepare(
      `UPDATE users
       SET current_weight_kg = ?, updated_at = datetime('now')
       WHERE id = ?`
    ),
  };
  return _stmts;
};

export type UpsertFromLineInput = {
  line_user_id: string;
  display_name?: string | null;
};

export const userRepository = {
  findByLineUserId: (lineUserId: string): User | undefined => {
    return stmts().findByLine.get(lineUserId) as User | undefined;
  },

  findById: (id: number): User | undefined => {
    return stmts().findById.get(id) as User | undefined;
  },

  upsertFromLine: (input: UpsertFromLineInput): User => {
    const s = stmts();
    const existing = s.findByLine.get(input.line_user_id) as User | undefined;

    if (existing) {
      if (input.display_name && input.display_name !== existing.display_name) {
        s.updateDisplayName.run(input.display_name, existing.id, input.display_name);
        return s.findById.get(existing.id) as User;
      }
      return existing;
    }

    const info = s.insert.run(input.line_user_id, input.display_name ?? null);
    const id = Number(info.lastInsertRowid);
    return s.findById.get(id) as User;
  },

  listProfileCompleted: (): User[] => {
    return stmts().listProfileCompleted.all() as User[];
  },

  syncWeightChange: (userId: number, weightKg: number): User | undefined => {
    const s = stmts();
    const existing = s.findById.get(userId) as User | undefined;
    if (existing === undefined) return undefined;
    const profileComplete =
      existing.gender !== null &&
      existing.date_of_birth !== null &&
      existing.height_cm !== null &&
      existing.activity_level !== null &&
      existing.goal_type !== null &&
      existing.target_weight_kg !== null;

    if (!profileComplete) {
      s.updateCurrentWeight.run(weightKg, userId);
      return s.findById.get(userId) as User;
    }

    const goals = calculateNutritionGoals({
      gender: existing.gender!,
      date_of_birth: existing.date_of_birth!,
      height_cm: existing.height_cm!,
      current_weight_kg: weightKg,
      target_weight_kg: existing.target_weight_kg!,
      activity_level: existing.activity_level!,
      goal_type: existing.goal_type!,
    });
    s.updateProfile.run({
      id: userId,
      gender: existing.gender,
      date_of_birth: existing.date_of_birth,
      height_cm: existing.height_cm,
      current_weight_kg: weightKg,
      target_weight_kg: existing.target_weight_kg,
      activity_level: existing.activity_level,
      goal_type: existing.goal_type,
      bmr_kcal: goals.bmr_kcal,
      tdee_kcal: goals.tdee_kcal,
      daily_calorie_goal: goals.daily_calorie_goal,
      daily_protein_g: goals.daily_protein_g,
      daily_carbs_g: goals.daily_carbs_g,
      daily_fat_g: goals.daily_fat_g,
    });
    return s.findById.get(userId) as User;
  },

  updateProfile: (userId: number, input: ProfileInput): User => {
    const s = stmts();
    const goals = calculateNutritionGoals(input);
    s.updateProfile.run({
      id: userId,
      gender: input.gender,
      date_of_birth: input.date_of_birth,
      height_cm: input.height_cm,
      current_weight_kg: input.current_weight_kg,
      target_weight_kg: input.target_weight_kg,
      activity_level: input.activity_level,
      goal_type: input.goal_type,
      bmr_kcal: goals.bmr_kcal,
      tdee_kcal: goals.tdee_kcal,
      daily_calorie_goal: goals.daily_calorie_goal,
      daily_protein_g: goals.daily_protein_g,
      daily_carbs_g: goals.daily_carbs_g,
      daily_fat_g: goals.daily_fat_g,
    });
    const updated = s.findById.get(userId) as User | undefined;
    if (updated === undefined) {
      throw new Error(`updateProfile: user ${userId} not found after update`);
    }
    return updated;
  },
};
