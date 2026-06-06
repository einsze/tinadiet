import 'dotenv/config';
import express, { type Request, type Response } from 'express';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const COMMIT_SHA = process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const STARTED_AT = new Date().toISOString();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'tinadiet-backend',
    env: NODE_ENV,
    commit: COMMIT_SHA.slice(0, 7),
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

const server = app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    msg: 'server.listen',
    port: PORT,
    env: NODE_ENV,
    commit: COMMIT_SHA.slice(0, 7),
  }));
});

const shutdown = (signal: string) => {
  console.log(JSON.stringify({ level: 'info', msg: 'server.shutdown', signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
