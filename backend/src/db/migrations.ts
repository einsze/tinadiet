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
  {
    name: '0002_food_logs',
    sql: `
      CREATE TABLE food_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        logged_at       TEXT NOT NULL DEFAULT (datetime('now')),
        date            TEXT NOT NULL,
        meal_type       TEXT CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
        food_name_th    TEXT,
        food_name_en    TEXT,
        quantity_text   TEXT,
        kcal            REAL NOT NULL,
        protein_g       REAL NOT NULL DEFAULT 0,
        carbs_g         REAL NOT NULL DEFAULT 0,
        fat_g           REAL NOT NULL DEFAULT 0,
        source          TEXT NOT NULL CHECK(source IN ('manual','chat_regex','chat_ai','photo')),
        raw_text        TEXT,
        confidence      REAL,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_food_logs_user_date ON food_logs(user_id, date);
      CREATE INDEX idx_food_logs_logged_at ON food_logs(logged_at);
    `,
  },
  {
    name: '0003_weight_logs',
    sql: `
      CREATE TABLE weight_logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        logged_at   TEXT NOT NULL DEFAULT (datetime('now')),
        date        TEXT NOT NULL,
        weight_kg   REAL NOT NULL,
        note        TEXT,
        source      TEXT NOT NULL CHECK(source IN ('manual','chat')),
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_weight_logs_user_date ON weight_logs(user_id, date);
      CREATE INDEX idx_weight_logs_user_logged ON weight_logs(user_id, logged_at);
    `,
  },
  {
    name: '0004_food_logs_kcal_range',
    sql: `
      ALTER TABLE food_logs ADD COLUMN kcal_low  REAL;
      ALTER TABLE food_logs ADD COLUMN kcal_high REAL;
      UPDATE food_logs SET kcal_low = kcal, kcal_high = kcal WHERE kcal_low IS NULL;
    `,
  },
  {
    name: '0005_chat_messages',
    sql: `
      CREATE TABLE chat_messages (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role        TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content     TEXT NOT NULL,
        date        TEXT NOT NULL,
        refused     INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);
      CREATE INDEX idx_chat_messages_user_date    ON chat_messages(user_id, date);
    `,
  },
];
