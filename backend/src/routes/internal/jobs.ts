import { Router, type Request, type Response } from 'express';
import { env } from '../../config/env.js';
import { runDailySummary } from '../../jobs/daily_summary.js';
import { runWeeklySummary } from '../../jobs/weekly_summary.js';
import { runExpirePremium } from '../../jobs/expire_premium.js';
import { runRenewalReminders } from '../../jobs/renewal_reminders.js';
import { runExpireGifts } from '../../jobs/expire_gifts.js';

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

router.post('/weekly-summary', async (req: Request, res: Response) => {
  if (!checkSecret(req, res)) return;
  const dryRun = req.query.dry_run === 'true';
  try {
    const result = await runWeeklySummary(dryRun);
    res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: msg } });
  }
});

router.post('/expire-premium', async (req: Request, res: Response) => {
  if (!checkSecret(req, res)) return;
  const dryRun = req.query.dry_run === 'true';
  try {
    const result = await runExpirePremium(dryRun);
    res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: msg } });
  }
});

router.post('/renewal-reminders', async (req: Request, res: Response) => {
  if (!checkSecret(req, res)) return;
  const dryRun = req.query.dry_run === 'true';
  try {
    const result = await runRenewalReminders(dryRun);
    res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: msg } });
  }
});

router.post('/expire-gifts', async (req: Request, res: Response) => {
  if (!checkSecret(req, res)) return;
  const dryRun = req.query.dry_run === 'true';
  try {
    const result = await runExpireGifts(dryRun);
    res.status(200).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: msg } });
  }
});

export default router;
