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
  {
    name: '0006_subscriptions',
    sql: `
      ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','premium'));
      ALTER TABLE users ADD COLUMN premium_expires_at TEXT;
      ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
      CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

      CREATE TABLE subscriptions (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider                 TEXT NOT NULL CHECK(provider IN ('stripe')),
        provider_subscription_id TEXT NOT NULL,
        provider_customer_id     TEXT NOT NULL,
        status                   TEXT NOT NULL,
        current_period_start     TEXT,
        current_period_end       TEXT,
        cancel_at_period_end     INTEGER NOT NULL DEFAULT 0,
        canceled_at              TEXT,
        last_event_type          TEXT,
        last_event_at            TEXT,
        created_at               TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_subscriptions_provider_sub
        ON subscriptions(provider, provider_subscription_id);
      CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
    `,
  },
  {
    name: '0007_omise_payments',
    sql: `
      ALTER TABLE users ADD COLUMN omise_customer_id TEXT;
      CREATE INDEX idx_users_omise_customer ON users(omise_customer_id);

      CREATE TABLE payments (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider                 TEXT NOT NULL CHECK(provider IN ('omise')),
        provider_charge_id       TEXT NOT NULL,
        provider_source_id       TEXT,
        method                   TEXT NOT NULL CHECK(method IN ('promptpay','truemoney')),
        amount_satang            INTEGER NOT NULL,
        currency                 TEXT NOT NULL DEFAULT 'thb',
        status                   TEXT NOT NULL CHECK(status IN
                                   ('pending','successful','failed','expired','reversed')),
        failure_code             TEXT,
        failure_message          TEXT,
        authorize_uri            TEXT,
        qr_image_uri             TEXT,
        expires_at               TEXT,
        completed_at             TEXT,
        grant_days               INTEGER NOT NULL DEFAULT 30,
        grant_starts_at          TEXT,
        grant_ends_at            TEXT,
        last_event_type          TEXT,
        last_event_at            TEXT,
        created_at               TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX idx_payments_provider_charge
        ON payments(provider, provider_charge_id);
      CREATE INDEX idx_payments_user_created
        ON payments(user_id, created_at DESC);
      CREATE INDEX idx_payments_status_expires
        ON payments(status, expires_at);
    `,
  },
];
