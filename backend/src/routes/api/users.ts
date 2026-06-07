import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';

const router = Router();

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

  res.status(200).json({ user });
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
    const user = userRepository.updateProfile(session.uid, parsed.data);
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'users.updateProfile.success',
        db_user_id: user.id,
        daily_calorie_goal: user.daily_calorie_goal,
      })
    );
    res.status(200).json({ user });
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
