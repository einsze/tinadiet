import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { dbFilePath } from './db/sqlite.js';
import apiV1Router from './routes/api/index.js';
import lineWebhookRouter from './routes/webhook/line.js';
import internalJobsRouter from './routes/internal/jobs.js';
import { startCronJobs } from './jobs/index.js';

const migrationResult = runMigrations();
console.log(
  JSON.stringify({
    level: 'info',
    msg: 'db.ready',
    file: dbFilePath,
    migrations_applied: migrationResult.applied.length,
    migrations_skipped: migrationResult.skipped.length,
  })
);

const app = express();
const STARTED_AT = new Date().toISOString();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use('/webhook', lineWebhookRouter);

const allowedOriginPatterns: Array<string | RegExp> = [
  'https://app.tinadiet.com',
  'https://liff.line.me',
  'http://localhost:5173',
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,
];

app.use(
  '/api/v1',
  cors({
    origin: (origin, callback) => {
      if (origin === undefined) {
        callback(null, true);
        return;
      }
      const allowed = allowedOriginPatterns.some((p) =>
        typeof p === 'string' ? p === origin : p.test(origin)
      );
      callback(null, allowed);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

app.use(express.json({ limit: '256kb' }));

app.use('/api/v1', apiV1Router);
app.use('/internal/jobs', internalJobsRouter);

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'tinadiet-backend',
    env: env.NODE_ENV,
    commit: env.COMMIT_SHA.slice(0, 7),
    started_at: STARTED_AT,
    uptime_seconds: Math.round(process.uptime()),
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.status(200).type('text/plain').send('Tina Diet backend. See /healthz');
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

const server = app.listen(env.PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    msg: 'server.listen',
    port: env.PORT,
    env: env.NODE_ENV,
    commit: env.COMMIT_SHA.slice(0, 7),
  }));
  startCronJobs();
});

const shutdown = (signal: string) => {
  console.log(JSON.stringify({ level: 'info', msg: 'server.shutdown', signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
