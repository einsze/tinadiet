import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { dbFilePath } from './db/sqlite.js';
import lineWebhookRouter from './routes/webhook/line.js';

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

app.use(express.json({ limit: '256kb' }));

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
});

const shutdown = (signal: string) => {
  console.log(JSON.stringify({ level: 'info', msg: 'server.shutdown', signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
