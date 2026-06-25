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
  {
    name: '0008_credit_system',
    sql: `
      -- Credit balance + abuse fields on users
      ALTER TABLE users ADD COLUMN credit_balance_satang INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN abuse_warning_count   INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN is_blocked            INTEGER NOT NULL DEFAULT 0;

      -- Admin users (superadmin + operator)
      CREATE TABLE admin_users (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        email               TEXT    NOT NULL UNIQUE,
        password_hash       TEXT    NOT NULL,
        display_name        TEXT    NOT NULL,
        role                TEXT    NOT NULL CHECK(role IN ('superadmin','operator')),
        is_active           INTEGER NOT NULL DEFAULT 1,
        last_login_at       TEXT,
        created_by_admin_id INTEGER REFERENCES admin_users(id),
        created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_admin_users_email ON admin_users(email);

      -- Manual top-up payments (user uploads slip, operator reviews)
      CREATE TABLE manual_payments (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_amount_satang   INTEGER NOT NULL,
        actual_amount_satang      INTEGER,
        slip_file_path            TEXT,
        slip_mime_type            TEXT,
        slip_size_bytes           INTEGER,
        status                    TEXT    NOT NULL DEFAULT 'awaiting_slip'
                                    CHECK(status IN
                                      ('awaiting_slip','pending','approved','rejected','flagged_review','revoked')),
        reviewed_by_admin_id      INTEGER REFERENCES admin_users(id),
        reviewed_at               TEXT,
        rejection_reason          TEXT,
        admin_notes               TEXT,
        flag_user_as_abuse        INTEGER NOT NULL DEFAULT 0,
        credit_granted_satang     INTEGER,
        revoked_by_admin_id       INTEGER REFERENCES admin_users(id),
        revoked_at                TEXT,
        revoke_reason             TEXT,
        created_at                TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_manual_payments_user_created ON manual_payments(user_id, created_at DESC);
      CREATE INDEX idx_manual_payments_status_created ON manual_payments(status, created_at ASC);

      -- Credit ledger (immutable audit log per credit transaction)
      CREATE TABLE credit_ledger (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_satang             INTEGER NOT NULL,
        balance_after_satang      INTEGER NOT NULL,
        source_type               TEXT    NOT NULL CHECK(source_type IN
                                    ('manual_topup','omise_topup','admin_grant',
                                     'redeem_premium','revoke_topup','revoke_redeem')),
        source_ref_id             INTEGER,
        admin_user_id             INTEGER REFERENCES admin_users(id),
        note                      TEXT,
        created_at                TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at DESC);
      CREATE INDEX idx_credit_ledger_source ON credit_ledger(source_type, source_ref_id);

      -- User flags (audit trail for abuse warnings + manual blocks)
      CREATE TABLE user_flags (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        flag_type                 TEXT    NOT NULL CHECK(flag_type IN
                                    ('abuse_warning','manual_block')),
        reason                    TEXT,
        related_payment_id        INTEGER REFERENCES manual_payments(id),
        flagged_by_admin_id       INTEGER NOT NULL REFERENCES admin_users(id),
        flagged_at                TEXT    NOT NULL DEFAULT (datetime('now')),
        cleared_by_admin_id       INTEGER REFERENCES admin_users(id),
        cleared_at                TEXT,
        clear_reason              TEXT
      );
      CREATE INDEX idx_user_flags_user ON user_flags(user_id, flagged_at DESC);

      -- System settings (key-value singleton config)
      CREATE TABLE system_settings (
        key                       TEXT    PRIMARY KEY,
        value                     TEXT    NOT NULL,
        updated_by_admin_id       INTEGER REFERENCES admin_users(id),
        updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- Seed default settings
      INSERT INTO system_settings (key, value) VALUES
        ('promptpay_id',                ''),
        ('promptpay_id_type',           'mobile'),
        ('promptpay_receiver_name',     ''),
        ('price_1mo_credit',            '150'),
        ('price_3mo_credit',            '450'),
        ('price_6mo_credit',            '900'),
        ('price_12mo_credit',           '1800'),
        ('high_value_threshold_satang', '500000'),
        ('topup_min_satang',            '5000'),
        ('topup_max_satang',            '500000');

      -- Seed 2 superadmin accounts (bcrypt hashes pre-computed for the agreed
      -- passwords. Passwords can be rotated after login via /account page.)
      INSERT INTO admin_users (email, password_hash, display_name, role) VALUES
        ('send@carvi.click',
         '$2b$10$VEJMY54ug1SuCvbowwLmeusxlGBChdQS2xgQfbwQmIvwK0rD5geYW',
         'Owner (send@carvi.click)',
         'superadmin'),
        ('sellerprn25@gmail.com',
         '$2b$10$uw8/WHifqtz6LZ6p5NcCLu2oahEPee5xqD8CH6HoFtWU6KkWmEmyi',
         'Owner (sellerprn25@gmail.com)',
         'superadmin');
    `,
  },
  {
    name: '0009_themes',
    sql: `
      -- Active theme on users (NULL means "default" theme)
      ALTER TABLE users ADD COLUMN active_theme_slug TEXT;

      -- User-owned themes (permanent unlock once purchased)
      CREATE TABLE user_themes (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        theme_slug             TEXT    NOT NULL,
        price_credit_snapshot  INTEGER NOT NULL,
        purchased_at           TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, theme_slug)
      );
      CREATE INDEX idx_user_themes_user ON user_themes(user_id);

      -- Seed default theme prices (in credit). Admin can edit via /settings.
      INSERT INTO system_settings (key, value) VALUES
        ('price_theme_sakura_credit',   '50'),
        ('price_theme_ocean_credit',    '50'),
        ('price_theme_forest_credit',   '50'),
        ('price_theme_sunset_credit',   '50'),
        ('price_theme_midnight_credit', '80');

      -- Rebuild credit_ledger to extend source_type CHECK with 'theme_purchase'.
      -- SQLite cannot ALTER a CHECK constraint in place.
      CREATE TABLE credit_ledger_new (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_satang             INTEGER NOT NULL,
        balance_after_satang      INTEGER NOT NULL,
        source_type               TEXT    NOT NULL CHECK(source_type IN
                                    ('manual_topup','omise_topup','admin_grant',
                                     'redeem_premium','theme_purchase',
                                     'revoke_topup','revoke_redeem')),
        source_ref_id             INTEGER,
        admin_user_id             INTEGER REFERENCES admin_users(id),
        note                      TEXT,
        created_at                TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO credit_ledger_new
        (id, user_id, amount_satang, balance_after_satang, source_type,
         source_ref_id, admin_user_id, note, created_at)
        SELECT id, user_id, amount_satang, balance_after_satang, source_type,
               source_ref_id, admin_user_id, note, created_at
        FROM credit_ledger;
      DROP TABLE credit_ledger;
      ALTER TABLE credit_ledger_new RENAME TO credit_ledger;
      CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at DESC);
      CREATE INDEX idx_credit_ledger_source ON credit_ledger(source_type, source_ref_id);
    `,
  },
  {
    name: '0010_gifts',
    sql: `
      CREATE TABLE gifts (
        id                              INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_token                     TEXT    NOT NULL UNIQUE,
        sender_user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
        gift_type                       TEXT    NOT NULL CHECK(gift_type IN ('premium','theme')),
        payload                         TEXT    NOT NULL,
        credit_spent_satang             INTEGER NOT NULL,
        message                         TEXT,
        status                          TEXT    NOT NULL DEFAULT 'pending'
                                          CHECK(status IN ('pending','claimed','canceled','expired','refused','revoked')),
        claim_expires_at                TEXT    NOT NULL,
        claimed_at                      TEXT,
        canceled_at                     TEXT,
        expired_at                      TEXT,
        refused_at                      TEXT,
        refused_reason                  TEXT,
        revoked_at                      TEXT,
        revoked_by_admin_id             INTEGER REFERENCES admin_users(id),
        revoke_reason                   TEXT,
        applied_premium_ms_added        INTEGER,
        applied_theme_slug              TEXT,
        created_at                      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at                      TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_gifts_sender_created ON gifts(sender_user_id, created_at DESC);
      CREATE INDEX idx_gifts_recipient_claimed ON gifts(recipient_user_id, claimed_at DESC);
      CREATE INDEX idx_gifts_token ON gifts(claim_token);
      CREATE INDEX idx_gifts_status_created ON gifts(status, created_at DESC);
      CREATE INDEX idx_gifts_expiry_pending ON gifts(status, claim_expires_at);

      -- Rebuild credit_ledger to extend source_type CHECK with 'gift_send' + 'gift_refund'.
      CREATE TABLE credit_ledger_new (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_satang             INTEGER NOT NULL,
        balance_after_satang      INTEGER NOT NULL,
        source_type               TEXT    NOT NULL CHECK(source_type IN
                                    ('manual_topup','omise_topup','admin_grant',
                                     'redeem_premium','theme_purchase',
                                     'gift_send','gift_refund',
                                     'revoke_topup','revoke_redeem')),
        source_ref_id             INTEGER,
        admin_user_id             INTEGER REFERENCES admin_users(id),
        note                      TEXT,
        created_at                TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO credit_ledger_new
        (id, user_id, amount_satang, balance_after_satang, source_type,
         source_ref_id, admin_user_id, note, created_at)
        SELECT id, user_id, amount_satang, balance_after_satang, source_type,
               source_ref_id, admin_user_id, note, created_at
        FROM credit_ledger;
      DROP TABLE credit_ledger;
      ALTER TABLE credit_ledger_new RENAME TO credit_ledger;
      CREATE INDEX idx_credit_ledger_user_created ON credit_ledger(user_id, created_at DESC);
      CREATE INDEX idx_credit_ledger_source ON credit_ledger(source_type, source_ref_id);
    `,
  },
  {
    name: '0011_premium_7day_bundle',
    sql: `
      -- 7-day premium bundle price. Default 49 credit so it pairs with the
      -- new 49 THB top-up preset. Admin can edit via /settings; set to 0
      -- to hide the bundle from the LIFF marketplace.
      INSERT INTO system_settings (key, value) VALUES
        ('price_7d_credit', '49');
    `,
  },
];
