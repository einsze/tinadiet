import { db } from '../db/sqlite.js';
import type { User } from '../domain/types.js';

const userColumns = `
  id, line_user_id, display_name,
  gender, date_of_birth, height_cm,
  current_weight_kg, target_weight_kg,
  activity_level, goal_type,
  bmr_kcal, tdee_kcal, daily_calorie_goal,
  daily_protein_g, daily_carbs_g, daily_fat_g,
  locale, timezone,
  created_at, updated_at
`;

const findByLineUserIdStmt = db.prepare(
  `SELECT ${userColumns} FROM users WHERE line_user_id = ?`
);

const findByIdStmt = db.prepare(
  `SELECT ${userColumns} FROM users WHERE id = ?`
);

const insertStmt = db.prepare(
  `INSERT INTO users (line_user_id, display_name) VALUES (?, ?)`
);

const updateDisplayNameStmt = db.prepare(
  `UPDATE users
   SET display_name = ?, updated_at = datetime('now')
   WHERE id = ? AND (display_name IS NULL OR display_name != ?)`
);

export type UpsertFromLineInput = {
  line_user_id: string;
  display_name?: string | null;
};

export const userRepository = {
  findByLineUserId: (lineUserId: string): User | undefined => {
    return findByLineUserIdStmt.get(lineUserId) as User | undefined;
  },

  findById: (id: number): User | undefined => {
    return findByIdStmt.get(id) as User | undefined;
  },

  upsertFromLine: (input: UpsertFromLineInput): User => {
    const existing = findByLineUserIdStmt.get(input.line_user_id) as
      | User
      | undefined;

    if (existing) {
      if (input.display_name && input.display_name !== existing.display_name) {
        updateDisplayNameStmt.run(input.display_name, existing.id, input.display_name);
        return findByIdStmt.get(existing.id) as User;
      }
      return existing;
    }

    const info = insertStmt.run(input.line_user_id, input.display_name ?? null);
    const id = Number(info.lastInsertRowid);
    return findByIdStmt.get(id) as User;
  },
};
