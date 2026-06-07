import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { foodLogsRepository } from '../../repositories/food_logs.js';
import { isValidIsoDate, todayInTimezone } from '../../domain/date.js';

const router = Router();

const createSchema = z.object({
  food_name_th: z.string().min(1).max(200).nullable(),
  food_name_en: z.string().min(1).max(200).nullable(),
  quantity_text: z.string().min(1).max(100).nullable().optional(),
  meal_type: z
    .enum(['breakfast', 'lunch', 'dinner', 'snack'])
    .nullable()
    .optional(),
  kcal: z.number().min(0).max(5000),
  protein_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(500),
  raw_text: z.string().max(500).nullable().optional(),
});

router.get('/', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }

  const user = userRepository.findById(session.uid);
  if (!user) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
  const date =
    dateParam !== null && isValidIsoDate(dateParam)
      ? dateParam
      : todayInTimezone(user.timezone);

  if (dateParam !== null && !isValidIsoDate(dateParam)) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'date must be YYYY-MM-DD',
      },
    });
    return;
  }

  const logs = foodLogsRepository.listByUserAndDate(user.id, date);
  const totals = foodLogsRepository.totalsByUserAndDate(user.id, date);

  res.status(200).json({ date, logs, totals });
});

router.post('/', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }

  const user = userRepository.findById(session.uid);
  if (!user) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid food log input',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  try {
    const log = foodLogsRepository.create({
      user_id: user.id,
      user_timezone: user.timezone,
      meal_type: parsed.data.meal_type ?? null,
      food_name_th: parsed.data.food_name_th,
      food_name_en: parsed.data.food_name_en,
      quantity_text: parsed.data.quantity_text ?? null,
      kcal: parsed.data.kcal,
      protein_g: parsed.data.protein_g,
      carbs_g: parsed.data.carbs_g,
      fat_g: parsed.data.fat_g,
      source: 'manual',
      raw_text: parsed.data.raw_text ?? null,
      confidence: null,
    });
    res.status(201).json({ log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'food_logs.create.failed',
        db_user_id: user.id,
        error: msg,
      })
    );
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: 'Failed to create food log' } });
  }
});

export default router;
