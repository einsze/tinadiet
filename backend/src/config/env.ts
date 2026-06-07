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
  COMMIT_SHA: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',

  LINE_CHANNEL_ID: requireEnv('LINE_CHANNEL_ID'),
  LINE_CHANNEL_SECRET: requireEnv('LINE_CHANNEL_SECRET'),
  LINE_CHANNEL_ACCESS_TOKEN: requireEnv('LINE_CHANNEL_ACCESS_TOKEN'),

  LINE_LOGIN_CHANNEL_ID: requireEnv('LINE_LOGIN_CHANNEL_ID'),

  SESSION_JWT_SECRET: requireEnv('SESSION_JWT_SECRET'),

  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./data/app.db',

  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  OPENAI_TIMEOUT_MS: Number(process.env.OPENAI_TIMEOUT_MS ?? 10000),
} as const;

export type Env = typeof env;
