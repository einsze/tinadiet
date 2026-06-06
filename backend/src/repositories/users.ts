import type { Statement } from 'better-sqlite3';
import { db } from '../db/sqlite.js';
import type { User } from '../domain/types.js';

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
};
