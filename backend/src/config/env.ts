const requireEnv = (key: string): string => {
  const v = process.env[key];
  if (v === undefined || v.length === 0) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  TZ: process.env.TZ ?? 'Asia/Bangkok',
  APP_BASE_URL: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  LIFF_URL: process.env.LIFF_URL ?? 'https://app.tinadiet.com',
  LIFF_ID: process.env.LIFF_ID ?? '',
  COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',

  LINE_CHANNEL_ID: requireEnv('LINE_CHANNEL_ID'),
  LINE_CHANNEL_SECRET: requireEnv('LINE_CHANNEL_SECRET'),
  LINE_CHANNEL_ACCESS_TOKEN: requireEnv('LINE_CHANNEL_ACCESS_TOKEN'),

  LINE_LOGIN_CHANNEL_ID: requireEnv('LINE_LOGIN_CHANNEL_ID'),

  SESSION_JWT_SECRET: requireEnv('SESSION_JWT_SECRET'),

  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./data/app.db',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  OPENAI_VISION_MODEL: process.env.OPENAI_VISION_MODEL ?? 'gpt-4o',
  OPENAI_VISION_DETAIL: ((): 'low' | 'high' | 'auto' => {
    const raw = process.env.OPENAI_VISION_DETAIL ?? 'auto';
    return raw === 'low' || raw === 'high' ? raw : 'auto';
  })(),
  OPENAI_TIMEOUT_MS: Number(process.env.OPENAI_TIMEOUT_MS ?? 10000),
  PHOTO_DAILY_LIMIT: Number(process.env.PHOTO_DAILY_LIMIT ?? 10),
  CONSULT_DAILY_LIMIT: Number(process.env.CONSULT_DAILY_LIMIT ?? 20),
  CONSULT_HISTORY_MINUTES: Number(process.env.CONSULT_HISTORY_MINUTES ?? 120),
  CONSULT_HISTORY_MAX_MESSAGES: Number(
    process.env.CONSULT_HISTORY_MAX_MESSAGES ?? 10
  ),

  CRON_ENABLED: (process.env.CRON_ENABLED ?? 'true').toLowerCase() === 'true',
  CRON_TZ: process.env.CRON_TZ ?? 'Asia/Bangkok',
  DAILY_SUMMARY_CRON: process.env.DAILY_SUMMARY_CRON ?? '0 21 * * *',
  WEEKLY_SUMMARY_CRON: process.env.WEEKLY_SUMMARY_CRON ?? '0 8 * * 1',
  EXPIRE_PREMIUM_CRON: process.env.EXPIRE_PREMIUM_CRON ?? '0 2 * * *',
  RENEWAL_REMINDER_CRON: process.env.RENEWAL_REMINDER_CRON ?? '0 10 * * *',
  EXPIRE_GIFTS_CRON: process.env.EXPIRE_GIFTS_CRON ?? '0 3 * * *',
  JOBS_TRIGGER_SECRET: process.env.JOBS_TRIGGER_SECRET ?? '',

  GIFT_CLAIM_WINDOW_DAYS: Number(process.env.GIFT_CLAIM_WINDOW_DAYS ?? 7),
  GIFT_MAX_PENDING_PER_SENDER: Number(
    process.env.GIFT_MAX_PENDING_PER_SENDER ?? 5
  ),
  GIFT_MESSAGE_MAX_LENGTH: Number(process.env.GIFT_MESSAGE_MAX_LENGTH ?? 200),

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID ?? '',
  BILLING_SUCCESS_URL:
    process.env.BILLING_SUCCESS_URL ?? 'https://app.tinadiet.com/?upgraded=1',
  BILLING_CANCEL_URL:
    process.env.BILLING_CANCEL_URL ?? 'https://app.tinadiet.com/?upgrade_canceled=1',

  OMISE_PUBLIC_KEY: process.env.OMISE_PUBLIC_KEY ?? '',
  OMISE_SECRET_KEY: process.env.OMISE_SECRET_KEY ?? '',
  OMISE_API_BASE_URL: process.env.OMISE_API_BASE_URL ?? 'https://api.omise.co',
  OMISE_API_VERSION: process.env.OMISE_API_VERSION ?? '2019-05-29',
  OMISE_WEBHOOK_SECRET: process.env.OMISE_WEBHOOK_SECRET ?? '',
  PAYMENT_AMOUNT_THB: Number(process.env.PAYMENT_AMOUNT_THB ?? 150),
  PAYMENT_GRANT_DAYS: Number(process.env.PAYMENT_GRANT_DAYS ?? 30),
  PAYMENT_RETURN_URL:
    process.env.PAYMENT_RETURN_URL ?? 'https://app.tinadiet.com/premium?omise_return=1',

  // --- Admin dashboard + manual payment / credit system (Sprint 6 M4) ---
  ADMIN_JWT_SECRET: (process.env.ADMIN_JWT_SECRET ?? '').length > 0
    ? (process.env.ADMIN_JWT_SECRET ?? '')
    : (process.env.SESSION_JWT_SECRET ?? ''),
  ADMIN_BASE_URL: process.env.ADMIN_BASE_URL ?? 'https://admin.tinadiet.com',
  SLIP_STORAGE_DIR: process.env.SLIP_STORAGE_DIR ?? './data/slips',
  SLIP_MAX_BYTES: Number(process.env.SLIP_MAX_BYTES ?? 5 * 1024 * 1024),
} as const;

export type Env = typeof env;
