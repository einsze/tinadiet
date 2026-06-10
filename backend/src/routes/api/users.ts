import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { foodLogsRepository } from '../../repositories/food_logs.js';
import { todayInTimezone } from '../../domain/date.js';
import { computeStreakFromDates } from '../../domain/streak.js';
import {
  generateMealSuggestion,
  formatSuggestionForReply,
  currentHourInTimezone,
  CoachError,
} from '../../services/coach.js';
import { lineClient } from '../../line/client.js';
import type { User } from '../../domain/types.js';

const router = Router();

const STREAK_LOOKBACK_DAYS = 90;

const computeStreakFor = (userId: number, today: string): number => {
  const dates = foodLogsRepository.distinctLogDatesRecent(
    userId,
    today,
    STREAK_LOOKBACK_DAYS
  );
  return computeStreakFromDates(dates, today);
};

const pushWelcomeSuggestion = async (user: User): Promise<void> => {
  try {
    const today = todayInTimezone(user.timezone);
    const totals = foodLogsRepository.totalsByUserAndDate(user.id, today);
    const recentLogs = foodLogsRepository.listByUserAndDate(user.id, today);
    const { result, usage } = await generateMealSuggestion({
      user,
      trigger: 'welcome',
      current_hour_local: currentHourInTimezone(user.timezone),
      today_totals: totals,
      recent_logs: recentLogs.reverse(),
      just_eaten_kcal: null,
    });
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'users.welcome.coach.ok',
        db_user_id: user.id,
        model: usage.model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        latency_ms: usage.latency_ms,
      })
    );
    const goalLine = `🎯 เป้าหมายแคลของคุณ: ${user.daily_calorie_goal} kcal/วัน`;
    const intro = `สวัสดีค่ะ ฉัน Tina 🌱\nยินดีต้อนรับเข้าสู่การดูแลโภชนาการกับฉันนะคะ`;
    const suggestionText = formatSuggestionForReply(result);
    const finalText = `${intro}\n\n${goalLine}\n\n${suggestionText}`;
    await lineClient.pushMessage({
      to: user.line_user_id,
      messages: [{ type: 'text', text: finalText }],
    });
  } catch (err) {
    const isCoachErr = err instanceof CoachError;
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'users.welcome.coach.failed',
        db_user_id: user.id,
        is_coach_error: isCoachErr,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
};

const profileSchema = z.object({
  gender: z.enum(['male', 'female', 'other']),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_of_birth must be YYYY-MM-DD')
    .refine((s) => {
      const d = new Date(`${s}T00:00:00Z`);
      if (Number.isNaN(d.getTime())) return false;
      const now = new Date();
      const age = now.getUTCFullYear() - d.getUTCFullYear();
      return age >= 10 && age <= 100;
    }, 'age must be between 10 and 100 years'),
  height_cm: z.number().min(100).max(250),
  current_weight_kg: z.number().min(30).max(300),
  target_weight_kg: z.number().min(30).max(300),
  activity_level: z.enum([
    'sedentary',
    'light',
    'moderate',
    'active',
    'very_active',
  ]),
  goal_type: z.enum(['loss', 'maintain', 'gain']),
});

router.get('/me', requireAuth, (req: Request, res: Response) => {
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

  const streak = computeStreakFor(user.id, todayInTimezone(user.timezone));
  res.status(200).json({ user, streak });
});

router.patch('/me', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }

  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid profile input',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  try {
    const previous = userRepository.findById(session.uid);
    const wasFirstSetup =
      previous !== undefined && previous.daily_calorie_goal === null;
    const user = userRepository.updateProfile(session.uid, parsed.data);
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'users.updateProfile.success',
        db_user_id: user.id,
        daily_calorie_goal: user.daily_calorie_goal,
        first_setup: wasFirstSetup,
      })
    );
    const streak = computeStreakFor(user.id, todayInTimezone(user.timezone));
    res.status(200).json({ user, streak });
    if (wasFirstSetup && user.daily_calorie_goal !== null) {
      void pushWelcomeSuggestion(user);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'users.updateProfile.failed',
        db_user_id: session.uid,
        error: msg,
      })
    );
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: 'Failed to update profile' } });
  }
});

export default router;
