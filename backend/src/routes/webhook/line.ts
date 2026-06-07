import { Router, type Request, type Response } from 'express';
import {
  middleware as lineMiddleware,
  type WebhookEvent,
  type MessageEvent,
  type TextEventMessage,
} from '@line/bot-sdk';
import { lineClient, lineSignatureConfig } from '../../line/client.js';
import { userRepository } from '../../repositories/users.js';
import { foodLogsRepository } from '../../repositories/food_logs.js';
import {
  parseTextToFoodLog,
  FoodParserError,
} from '../../services/food_parser.js';
import { todayInTimezone } from '../../domain/date.js';
import type { User } from '../../domain/types.js';

const router = Router();

const isTextMessageEvent = (
  event: WebhookEvent
): event is MessageEvent & { message: TextEventMessage } =>
  event.type === 'message' && event.message.type === 'text';

const GREETING_RE =
  /^(hi|hello|halo|hey|yo|hai|ok|okay|thanks|thank you|ขอบคุณ|สวัสดี|ครับ|ค่ะ|haha|lol|tina)(\s+tina)?$/i;
const HINT_TEXT =
  'สวัสดีค่ะ ฉัน Tina 🌱\nบอกฉันได้เลยว่าวันนี้ทานอะไร ฉันจะคำนวณแคลให้\nตัวอย่าง: "ผัดกะเพราไก่ไข่ดาว" หรือ "1 plate of pad thai"';

type IntentDecision = {
  kind: 'skip_command' | 'skip_greeting' | 'skip_empty' | 'attempt_parse';
};

const classifyIntent = (text: string): IntentDecision => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { kind: 'skip_empty' };
  if (trimmed.startsWith('/')) return { kind: 'skip_command' };
  if (trimmed.length < 3) return { kind: 'skip_greeting' };
  if (GREETING_RE.test(trimmed)) return { kind: 'skip_greeting' };
  return { kind: 'attempt_parse' };
};

const formatConfirmation = (
  user: User,
  foodNameTh: string | null,
  foodNameEn: string | null,
  kcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number
): string => {
  const today = todayInTimezone(user.timezone);
  const totals = foodLogsRepository.totalsByUserAndDate(user.id, today);
  const nameLine =
    foodNameTh && foodNameEn
      ? `${foodNameTh} (${foodNameEn})`
      : (foodNameTh ?? foodNameEn ?? 'Food');
  const macros = `${Math.round(kcal)} kcal · ${Math.round(proteinG)}p · ${Math.round(carbsG)}c · ${Math.round(fatG)}f`;
  const goal = user.daily_calorie_goal;
  const progress =
    goal !== null
      ? `\nToday: ${totals.kcal} / ${goal} kcal`
      : `\nToday: ${totals.kcal} kcal logged`;
  return `✅ ${nameLine}\n${macros}${progress}`;
};

const handleEvent = async (event: WebhookEvent): Promise<void> => {
  if (!isTextMessageEvent(event)) return;

  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  const user = userRepository.upsertFromLine({ line_user_id: lineUserId });
  const text = event.message.text;

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'webhook.message.text',
      db_user_id: user.id,
      line_user_id: lineUserId,
      text_length: text.length,
    })
  );

  const intent = classifyIntent(text);
  if (intent.kind !== 'attempt_parse') {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.intent.skipped',
        db_user_id: user.id,
        reason: intent.kind,
      })
    );
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: HINT_TEXT }],
    });
    return;
  }

  try {
    const { result, usage } = await parseTextToFoodLog(text);
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.parser.usage',
        db_user_id: user.id,
        model: usage.model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        latency_ms: usage.latency_ms,
        is_food: result.is_food,
        confidence: result.confidence,
      })
    );

    if (!result.is_food) {
      const reason = result.reason ?? '';
      const replyText =
        reason.length > 0
          ? `${reason}\n\n${HINT_TEXT}`
          : HINT_TEXT;
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: replyText }],
      });
      return;
    }

    const log = foodLogsRepository.create({
      user_id: user.id,
      user_timezone: user.timezone,
      meal_type: result.meal_type,
      food_name_th: result.food_name_th,
      food_name_en: result.food_name_en,
      quantity_text: result.quantity_text,
      kcal: result.kcal,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      source: 'chat_ai',
      raw_text: text,
      confidence: result.confidence,
    });

    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.food_log.created',
        db_user_id: user.id,
        log_id: log.id,
        kcal: log.kcal,
      })
    );

    const replyText = formatConfirmation(
      user,
      result.food_name_th,
      result.food_name_en,
      result.kcal,
      result.protein_g,
      result.carbs_g,
      result.fat_g
    );

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: replyText }],
    });
  } catch (err) {
    const isParserErr = err instanceof FoodParserError;
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'webhook.parser.failed',
        db_user_id: user.id,
        is_parser_error: isParserErr,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: 'ขออภัยค่ะ ยังประมวลผลข้อความไม่ได้ ลองอีกครั้งสักครู่นะคะ',
        },
      ],
    });
  }
};

router.post(
  '/line',
  lineMiddleware(lineSignatureConfig),
  async (req: Request, res: Response) => {
    const events: WebhookEvent[] = req.body.events ?? [];

    res.status(200).json({ ok: true });

    await Promise.all(
      events.map((event) =>
        handleEvent(event).catch((err: unknown) => {
          console.error(
            JSON.stringify({
              level: 'error',
              msg: 'webhook.handler.error',
              event_type: event.type,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        })
      )
    );
  }
);

export default router;
