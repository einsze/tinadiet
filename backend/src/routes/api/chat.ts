import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { chatMessagesRepository } from '../../repositories/chat_messages.js';
import {
  runConsultation,
  ConsultationError,
} from '../../services/consultation.js';
import { todayInTimezone } from '../../domain/date.js';
import { isProfileComplete, isPremium } from '../../domain/profile.js';
import { env } from '../../config/env.js';

const router = Router();

const sendSchema = z.object({
  content: z.string().min(1).max(1000),
});

const MAX_HISTORY_LIMIT = 200;
const DEFAULT_HISTORY_LIMIT = 50;

router.get('/messages', requireAuth, (req: Request, res: Response) => {
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

  const limitParam =
    typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN;
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(Math.floor(limitParam), MAX_HISTORY_LIMIT))
    : DEFAULT_HISTORY_LIMIT;

  const messages = chatMessagesRepository.listRecent(user.id, limit);
  const today = todayInTimezone(user.timezone);
  const questionsToday = chatMessagesRepository.countQuestionsToday(
    user.id,
    today
  );

  res.status(200).json({
    messages,
    quota: {
      questions_today: questionsToday,
      limit: env.CONSULT_DAILY_LIMIT,
      remaining: Math.max(env.CONSULT_DAILY_LIMIT - questionsToday, 0),
    },
  });
});

router.post('/messages', requireAuth, async (req: Request, res: Response) => {
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

  if (!isProfileComplete(user)) {
    res.status(403).json({
      error: {
        code: 'REQUIRE_PROFILE',
        message:
          'ตั้งค่าโปรไฟล์ของคุณก่อน Tina จึงจะตอบคำถามได้ค่ะ',
      },
    });
    return;
  }

  if (!isPremium(user)) {
    res.status(403).json({
      error: {
        code: 'PREMIUM_REQUIRED',
        message:
          'การถามคำปรึกษาเป็นฟีเจอร์ของ Premium ค่ะ สมัครเพื่อปลดล็อกได้เลย',
      },
    });
    return;
  }

  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'content must be a non-empty string up to 1000 chars',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  try {
    const outcome = await runConsultation({
      user,
      question: parsed.data.content,
    });

    if (outcome.kind === 'quota_exceeded') {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'chat.api.quota_exceeded',
          db_user_id: user.id,
          count: outcome.questions_today,
          limit: outcome.limit,
        })
      );
      res.status(429).json({
        error: {
          code: 'QUOTA_EXCEEDED',
          message: `วันนี้ถามครบ ${outcome.limit} คำถามแล้วค่ะ พรุ่งนี้ Tina ยินดีตอบใหม่นะคะ 🌱`,
        },
        quota: {
          questions_today: outcome.questions_today,
          limit: outcome.limit,
          remaining: 0,
        },
      });
      return;
    }

    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'chat.api.ok',
        db_user_id: user.id,
        model: outcome.usage.model,
        input_tokens: outcome.usage.input_tokens,
        output_tokens: outcome.usage.output_tokens,
        latency_ms: outcome.usage.latency_ms,
        topic: outcome.topic,
        refused: outcome.refused,
        questions_today: outcome.questions_today,
      })
    );

    res.status(201).json({
      user_message: outcome.user_message,
      assistant_message: outcome.assistant_message,
      quota: {
        questions_today: outcome.questions_today,
        limit: outcome.limit,
        remaining: Math.max(outcome.limit - outcome.questions_today, 0),
      },
    });
  } catch (err) {
    const isConsultErr = err instanceof ConsultationError;
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'chat.api.failed',
        db_user_id: user.id,
        is_consultation_error: isConsultErr,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'Failed to get answer from Tina',
      },
    });
  }
});

export default router;
