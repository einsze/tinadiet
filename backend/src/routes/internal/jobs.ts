import { Router, type Request, type Response } from 'express';
import { env } from '../../config/env.js';
import { runDailySummary } from '../../jobs/daily_summary.js';

const router = Router();

const checkSecret = (req: Request, res: Response): boolean => {
  if (env.JOBS_TRIGGER_SECRET.length === 0) {
    res.status(503).json({
      error: {
        code: 'SECRET_NOT_CONFIGURED',
        message: 'JOBS_TRIGGER_SECRET is not set in env',
      },
    });
    return false;
  }
  const provided = req.headers['x-jobs-secret'];
  if (provided !== env.JOBS_TRIGGER_SECRET) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Bad secret' } });
    return false;
  }
  return true;
};

router.post('/daily-summary', async (req: Request, res: Response) => {
  if (!checkSecret(req, res)) return;
  const dryRun = req.query.dry_run === 'true';
  try {
    const result = await runDailySummary(dryRun);
    res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: msg } });
  }
});

export default router;
