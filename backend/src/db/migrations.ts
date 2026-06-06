export type Migration = {
  name: string;
  sql: string;
};

export const migrations: ReadonlyArray<Migration> = [
  {
    name: '0001_users',
    sql: `
      CREATE TABLE users (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        line_user_id        TEXT NOT NULL UNIQUE,
        display_name        TEXT,
        gender              TEXT CHECK(gender IN ('male','female','other')),
        date_of_birth       TEXT,
        height_cm           REAL,
        current_weight_kg   REAL,
        target_weight_kg    REAL,
        activity_level      TEXT CHECK(activity_level IN
                              ('sedentary','light','moderate','active','very_active')),
        goal_type           TEXT CHECK(goal_type IN ('loss','maintain','gain')),
        bmr_kcal            REAL,
        tdee_kcal           REAL,
        daily_calorie_goal  REAL,
        daily_protein_g     REAL,
        daily_carbs_g       REAL,
        daily_fat_g         REAL,
        locale              TEXT NOT NULL DEFAULT 'th-TH',
        timezone            TEXT NOT NULL DEFAULT 'Asia/Bangkok',
        created_at          TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_users_line ON users(line_user_id);
    `,
  },
];
