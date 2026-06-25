import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { foodLogsRepository } from '../../repositories/food_logs.js';
import { weightLogsRepository } from '../../repositories/weight_logs.js';
import {
  isValidIsoDate,
  shiftIsoDate,
  todayInTimezone,
} from '../../domain/date.js';
import { isPremium } from '../../domain/profile.js';

const router = Router();

const FREE_DAYS_BACK = 30;
const PREMIUM_DAYS_BACK = 365;

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

  const today = todayInTimezone(user.timezone);
  const daysBack = isPremium(user) ? PREMIUM_DAYS_BACK : FREE_DAYS_BACK;
  const minDate = shiftIsoDate(today, -daysBack);

  const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
  if (dateParam !== null && !isValidIsoDate(dateParam)) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'date must be YYYY-MM-DD',
      },
    });
    return;
  }
  const date = dateParam ?? today;

  if (date > today) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'date cannot be in the future',
      },
    });
    return;
  }

  if (date < minDate) {
    res.status(403).json({
      error: {
        code: 'DATE_OUT_OF_RANGE',
        message: isPremium(user)
          ? 'date is more than 365 days ago'
          : 'date is more than 30 days ago — upgrade to Premium to see older history',
        allowed_range: { min: minDate, max: today },
        plan: user.plan,
      },
    });
    return;
  }

  const food_logs = foodLogsRepository.listByUserAndDate(user.id, date);
  const food_totals = foodLogsRepository.totalsByUserAndDate(user.id, date);
  const weight_log = weightLogsRepository.findByUserAndDate(user.id, date) ?? null;

  res.status(200).json({
    date,
    food_logs,
    food_totals,
    weight_log,
    goals: {
      daily_calorie_goal: user.daily_calorie_goal,
      daily_protein_g: user.daily_protein_g,
      daily_carbs_g: user.daily_carbs_g,
      daily_fat_g: user.daily_fat_g,
    },
    allowed_range: { min: minDate, max: today },
    plan: user.plan,
    is_premium: isPremium(user),
  });
});

export default router;
