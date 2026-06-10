import { Router, type Request, type Response } from 'express';
import {
  middleware as lineMiddleware,
  type WebhookEvent,
  type MessageEvent,
  type TextEventMessage,
  type ImageEventMessage,
} from '@line/bot-sdk';
import {
  lineClient,
  lineSignatureConfig,
  fetchMessageContentAsBase64,
} from '../../line/client.js';
import { env } from '../../config/env.js';
import { userRepository } from '../../repositories/users.js';
import { foodLogsRepository } from '../../repositories/food_logs.js';
import { weightLogsRepository } from '../../repositories/weight_logs.js';
import { chatMessagesRepository } from '../../repositories/chat_messages.js';
import {
  parseTextToFoodLog,
  parseImageToFoodLog,
  FoodParserError,
  type FoodParserResult,
} from '../../services/food_parser.js';
import {
  generateMealSuggestion,
  formatSuggestionForReply,
  currentHourInTimezone,
  CoachError,
} from '../../services/coach.js';
import {
  runConsultation,
  ConsultationError,
} from '../../services/consultation.js';
import { todayInTimezone } from '../../domain/date.js';
import type { FoodLog, FoodLogTotals, User } from '../../domain/types.js';

const router = Router();

const isTextMessageEvent = (
  event: WebhookEvent
): event is MessageEvent & { message: TextEventMessage } =>
  event.type === 'message' && event.message.type === 'text';

const isImageMessageEvent = (
  event: WebhookEvent
): event is MessageEvent & { message: ImageEventMessage } =>
  event.type === 'message' && event.message.type === 'image';

const GREETING_RE =
  /^(hi|hello|halo|hey|yo|hai|ok|okay|thanks|thank you|ขอบคุณ|สวัสดี|ครับ|ค่ะ|haha|lol|tina)(\s+tina)?$/i;
const HINT_TEXT =
  'สวัสดีค่ะ ฉัน Tina 🌱\nบอกฉันได้เลยว่าวันนี้ทานอะไร ฉันจะคำนวณแคลให้\nตัวอย่าง: "ผัดกะเพราไก่ไข่ดาว" หรือ "1 plate of pad thai"\n\nพิมพ์ "วันนี้" เพื่อดูบันทึกของวันนี้';

const WEIGHT_LOG_RE =
  /^\s*(?:น้ำหนัก|ชั่ง(?:น้ำหนัก)?|weight|wt)\s*[:=]?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|กก|กิโล)?\s*$/i;
const WEIGHT_LOG_BARE_RE =
  /^\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|กก|กิโล)\s*$/i;

const parseWeightFromText = (text: string): number | null => {
  const m1 = text.match(WEIGHT_LOG_RE);
  if (m1 && m1[1]) {
    const w = Number(m1[1]);
    if (w >= 20 && w <= 400) return w;
  }
  const m2 = text.match(WEIGHT_LOG_BARE_RE);
  if (m2 && m2[1]) {
    const w = Number(m2[1]);
    if (w >= 20 && w <= 400) return w;
  }
  return null;
};

const isShowLogsRequest = (text: string): boolean => {
  const t = text.trim().toLowerCase();
  return (
    /^\/?logs?$/i.test(t) ||
    /^\/?today$/i.test(t) ||
    /^summary$/i.test(t) ||
    /^list$/i.test(t) ||
    /^what (did|have) i (eat|eaten|ate)/i.test(t) ||
    /^show (logs?|today|me)/i.test(t) ||
    /^วันนี้$/.test(t) ||
    /^วันนี้กินอะไรไป/.test(t) ||
    /^สรุป$/.test(t) ||
    /^รายการ$/.test(t)
  );
};

const QUESTION_MARK_RE = /[?？]/;
const QUESTION_PREFIX_RE =
  /^(ทำไม|อะไร|ไหน|เมื่อไหร่|เมื่อไร|อย่างไร|ยังไง|เท่าไหร่|เท่าไร|ใคร|ขอ|ช่วย|แนะนำ|บอก|สอน|อยาก|สงสัย|ควร|แทน|น้ำหนัก|ลด|เพิ่ม|ลดน้ำหนัก|เพิ่มน้ำหนัก|กินอะไร|why|what|how|when|where|who|can i|should i|is it|are\b|do i|am i|can you|recommend|suggest|help me|i want to know)\b/i;
const QUESTION_PARTICLE_RE = /(ไหม|มั้ย|รึเปล่า|หรือเปล่า|หรือไม่)\??$/;
const QUESTION_INLINE_PARTICLE_RE = /(ไหม|มั้ย|รึเปล่า|หรือเปล่า)/;

const isLikelyQuestion = (text: string): boolean => {
  const t = text.trim();
  if (t.length < 4) return false;
  if (QUESTION_MARK_RE.test(t)) return true;
  if (QUESTION_PREFIX_RE.test(t)) return true;
  if (QUESTION_PARTICLE_RE.test(t)) return true;
  if (QUESTION_INLINE_PARTICLE_RE.test(t) && t.length > 8) return true;
  return false;
};

type IntentDecision =
  | { kind: 'skip_command' }
  | { kind: 'skip_greeting' }
  | { kind: 'skip_empty' }
  | { kind: 'show_logs' }
  | { kind: 'log_weight'; weight_kg: number }
  | { kind: 'consult_question' }
  | { kind: 'attempt_parse' };

const classifyIntent = (text: string): IntentDecision => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { kind: 'skip_empty' };
  const weight = parseWeightFromText(trimmed);
  if (weight !== null) return { kind: 'log_weight', weight_kg: weight };
  if (isShowLogsRequest(trimmed)) return { kind: 'show_logs' };
  if (trimmed.startsWith('/')) return { kind: 'skip_command' };
  if (trimmed.length < 3) return { kind: 'skip_greeting' };
  if (GREETING_RE.test(trimmed)) return { kind: 'skip_greeting' };
  if (isLikelyQuestion(trimmed)) return { kind: 'consult_question' };
  return { kind: 'attempt_parse' };
};

const formatLogsList = (
  user: User,
  logs: FoodLog[],
  totals: FoodLogTotals
): string => {
  if (logs.length === 0) {
    return 'ยังไม่มีบันทึกอาหารวันนี้ค่ะ 🍽️\nลองพิมพ์ชื่ออาหารที่ทาน Tina จะคำนวณให้';
  }
  const lines = logs.map((log, i) => {
    const name =
      log.food_name_th ?? log.food_name_en ?? log.raw_text ?? 'อาหาร';
    const kcalStr = formatKcalRange(log.kcal_low, log.kcal_high, log.kcal);
    return `${i + 1}. ${name} · ${kcalStr} · ${Math.round(log.protein_g)}p/${Math.round(log.carbs_g)}c/${Math.round(log.fat_g)}f`;
  });
  const goal = user.daily_calorie_goal;
  const summary =
    goal !== null
      ? `\n\nรวม: ${totals.kcal} / ${goal} kcal\nเหลือ: ${Math.max(goal - totals.kcal, 0)} kcal`
      : `\n\nรวม: ${totals.kcal} kcal (${totals.count} รายการ)`;
  return `📋 วันนี้\n${lines.join('\n')}${summary}`;
};

type SavedItem = {
  food_name_th: string | null;
  food_name_en: string | null;
  kcal: number;
  kcal_low: number;
  kcal_high: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

const formatKcalRange = (low: number, high: number, mid: number): string => {
  const lo = Math.round(low);
  const hi = Math.round(high);
  if (lo === hi) return `${Math.round(mid)} kcal`;
  return `${lo}-${hi} kcal`;
};

const formatTodayLine = (user: User): string => {
  const today = todayInTimezone(user.timezone);
  const totals = foodLogsRepository.totalsByUserAndDate(user.id, today);
  const goal = user.daily_calorie_goal;
  return goal !== null
    ? `Today: ${totals.kcal} / ${goal} kcal`
    : `Today: ${totals.kcal} kcal logged`;
};

const formatSingleConfirmation = (user: User, item: SavedItem): string => {
  const nameLine =
    item.food_name_th && item.food_name_en
      ? `${item.food_name_th} (${item.food_name_en})`
      : (item.food_name_th ?? item.food_name_en ?? 'อาหาร');
  const kcalStr = formatKcalRange(item.kcal_low, item.kcal_high, item.kcal);
  const macros = `${kcalStr} · ${Math.round(item.protein_g)}p · ${Math.round(item.carbs_g)}c · ${Math.round(item.fat_g)}f`;
  return `✅ ${nameLine}\n${macros}\n${formatTodayLine(user)}`;
};

const formatMultiConfirmation = (user: User, items: SavedItem[]): string => {
  const lines = items.map((item, i) => {
    const name = item.food_name_th ?? item.food_name_en ?? 'อาหาร';
    const kcalStr = formatKcalRange(item.kcal_low, item.kcal_high, item.kcal);
    return `${i + 1}. ${name} · ${kcalStr}`;
  });
  const sessionKcal = items.reduce((sum, item) => sum + item.kcal, 0);
  return `✅ บันทึก ${items.length} รายการ\n${lines.join('\n')}\nรวมครั้งนี้: ${Math.round(sessionKcal)} kcal\n${formatTodayLine(user)}`;
};

const replyToParsedResult = async (
  user: User,
  result: FoodParserResult,
  replyToken: string,
  rawText: string | null,
  source: 'chat_ai' | 'photo'
): Promise<void> => {
  if (!result.is_food) {
    if (
      source === 'chat_ai' &&
      rawText !== null &&
      rawText.trim().length >= 10
    ) {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'webhook.consultation.fallback_from_not_food',
          db_user_id: user.id,
        })
      );
      await handleConsultation(user, rawText, replyToken, true);
      return;
    }
    const reason = result.reason ?? '';
    const replyText =
      reason.length > 0 ? `${reason}\n\n${HINT_TEXT}` : HINT_TEXT;
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: replyText }],
    });
    return;
  }

  if (result.needs_clarification) {
    const question =
      result.clarification_question ??
      'บอกชื่ออาหารที่ทานให้ละเอียดขึ้นได้ไหมคะ?';
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: question }],
    });
    return;
  }

  if (result.items.length === 0) {
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: HINT_TEXT }],
    });
    return;
  }

  const savedItems: SavedItem[] = result.items.map((item) => {
    const lo = Math.min(item.kcal_low, item.kcal);
    const hi = Math.max(item.kcal_high, item.kcal);
    const log = foodLogsRepository.create({
      user_id: user.id,
      user_timezone: user.timezone,
      meal_type: item.meal_type,
      food_name_th: item.food_name_th,
      food_name_en: item.food_name_en,
      quantity_text: item.quantity_text,
      kcal: item.kcal,
      kcal_low: lo,
      kcal_high: hi,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      source,
      raw_text: rawText,
      confidence: item.confidence,
    });
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.food_log.created',
        db_user_id: user.id,
        log_id: log.id,
        kcal: log.kcal,
        kcal_low: log.kcal_low,
        kcal_high: log.kcal_high,
        source,
      })
    );
    return {
      food_name_th: log.food_name_th,
      food_name_en: log.food_name_en,
      kcal: log.kcal,
      kcal_low: log.kcal_low,
      kcal_high: log.kcal_high,
      protein_g: log.protein_g,
      carbs_g: log.carbs_g,
      fat_g: log.fat_g,
    };
  });

  const confirmationText =
    savedItems.length === 1
      ? formatSingleConfirmation(user, savedItems[0]!)
      : formatMultiConfirmation(user, savedItems);

  let suggestionText: string | null = null;
  if (user.daily_calorie_goal !== null) {
    try {
      const today = todayInTimezone(user.timezone);
      const totals = foodLogsRepository.totalsByUserAndDate(user.id, today);
      const recentLogs = foodLogsRepository.listByUserAndDate(user.id, today);
      const justEatenKcal = savedItems.reduce((sum, it) => sum + it.kcal, 0);
      const { result, usage } = await generateMealSuggestion({
        user,
        trigger: 'after_log',
        current_hour_local: currentHourInTimezone(user.timezone),
        today_totals: totals,
        recent_logs: recentLogs.reverse(),
        just_eaten_kcal: justEatenKcal,
      });
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'webhook.coach.suggestion.ok',
          db_user_id: user.id,
          model: usage.model,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          latency_ms: usage.latency_ms,
        })
      );
      suggestionText = formatSuggestionForReply(result);
    } catch (err) {
      const isCoachErr = err instanceof CoachError;
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'webhook.coach.suggestion.failed',
          db_user_id: user.id,
          is_coach_error: isCoachErr,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  const finalText =
    suggestionText !== null
      ? `${confirmationText}\n\n${suggestionText}`
      : confirmationText;

  await lineClient.replyMessage({
    replyToken,
    messages: [{ type: 'text', text: finalText }],
  });
};

const handleConsultation = async (
  user: User,
  text: string,
  replyToken: string,
  fallbackFromParser: boolean
): Promise<void> => {
  try {
    const outcome = await runConsultation({ user, question: text });

    if (outcome.kind === 'quota_exceeded') {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'webhook.consultation.quota_exceeded',
          db_user_id: user.id,
          count: outcome.questions_today,
          limit: outcome.limit,
        })
      );
      await lineClient.replyMessage({
        replyToken,
        messages: [
          {
            type: 'text',
            text: `วันนี้ถามครบ ${outcome.limit} คำถามแล้วค่ะ\nพรุ่งนี้ Tina ยินดีตอบใหม่นะคะ 🌱`,
          },
        ],
      });
      return;
    }

    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.consultation.ok',
        db_user_id: user.id,
        model: outcome.usage.model,
        input_tokens: outcome.usage.input_tokens,
        output_tokens: outcome.usage.output_tokens,
        latency_ms: outcome.usage.latency_ms,
        topic: outcome.topic,
        refused: outcome.refused,
        fallback_from_parser: fallbackFromParser,
        questions_today: outcome.questions_today,
      })
    );

    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: outcome.assistant_message.content }],
    });
  } catch (err) {
    const isConsultErr = err instanceof ConsultationError;
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'webhook.consultation.failed',
        db_user_id: user.id,
        is_consultation_error: isConsultErr,
        fallback_from_parser: fallbackFromParser,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    await lineClient.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: 'ขออภัยค่ะ ตอบไม่ได้ตอนนี้ ลองอีกครั้งสักครู่นะคะ',
        },
      ],
    });
  }
};

const handleTextEvent = async (
  event: MessageEvent & { message: TextEventMessage }
): Promise<void> => {
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

  if (intent.kind === 'log_weight') {
    const log = weightLogsRepository.create({
      user_id: user.id,
      user_timezone: user.timezone,
      weight_kg: intent.weight_kg,
      note: null,
      source: 'chat',
    });
    const updated = userRepository.syncWeightChange(user.id, intent.weight_kg);
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.weight_log.created',
        db_user_id: user.id,
        log_id: log.id,
        weight_kg: intent.weight_kg,
        recomputed_goals:
          updated?.daily_calorie_goal !== null && updated?.daily_calorie_goal !== undefined,
      })
    );
    const lines: string[] = [`✅ บันทึกน้ำหนัก ${intent.weight_kg} kg`];
    if (
      updated !== undefined &&
      updated.target_weight_kg !== null
    ) {
      const diff = intent.weight_kg - updated.target_weight_kg;
      if (Math.abs(diff) < 0.5) {
        lines.push(`ถึงเป้าหมายแล้วค่ะ! 🎯`);
      } else if (diff > 0) {
        lines.push(`เป้าหมาย: ${updated.target_weight_kg} kg · ห่าง ${diff.toFixed(1)} kg`);
      } else {
        lines.push(`เป้าหมาย: ${updated.target_weight_kg} kg · ขาด ${Math.abs(diff).toFixed(1)} kg`);
      }
    }
    if (updated?.daily_calorie_goal !== null && updated?.daily_calorie_goal !== undefined) {
      lines.push(`เป้าหมายแคลใหม่: ${updated.daily_calorie_goal} kcal/วัน`);
    }
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: lines.join('\n') }],
    });
    return;
  }

  if (intent.kind === 'show_logs') {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.intent.show_logs',
        db_user_id: user.id,
      })
    );
    const date = todayInTimezone(user.timezone);
    const logs = foodLogsRepository.listByUserAndDate(user.id, date);
    const totals = foodLogsRepository.totalsByUserAndDate(user.id, date);
    const replyText = formatLogsList(user, logs, totals);
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: replyText }],
    });
    return;
  }

  if (intent.kind === 'consult_question') {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.intent.consult_question',
        db_user_id: user.id,
      })
    );
    await handleConsultation(user, text, event.replyToken, false);
    return;
  }

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
        needs_clarification: result.needs_clarification,
        item_count: result.items.length,
      })
    );
    await replyToParsedResult(user, result, event.replyToken, text, 'chat_ai');
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

const handleImageEvent = async (
  event: MessageEvent & { message: ImageEventMessage }
): Promise<void> => {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;

  const user = userRepository.upsertFromLine({ line_user_id: lineUserId });
  const today = todayInTimezone(user.timezone);
  const count = foodLogsRepository.countPhotoLogsToday(user.id, today);

  if (count >= env.PHOTO_DAILY_LIMIT) {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.vision.quota_exceeded',
        db_user_id: user.id,
        count,
        limit: env.PHOTO_DAILY_LIMIT,
      })
    );
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: 'text',
          text: `วันนี้ส่งรูปครบ ${env.PHOTO_DAILY_LIMIT} รูปแล้วค่ะ\nลองพิมพ์ชื่ออาหารแทนนะคะ พรุ่งนี้ส่งรูปได้อีก`,
        },
      ],
    });
    return;
  }

  try {
    const { base64, mimeType } = await fetchMessageContentAsBase64(
      event.message.id
    );
    const { result, usage } = await parseImageToFoodLog(base64, mimeType);
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'webhook.vision.usage',
        db_user_id: user.id,
        model: usage.model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        latency_ms: usage.latency_ms,
        is_food: result.is_food,
        needs_clarification: result.needs_clarification,
        item_count: result.items.length,
      })
    );
    await replyToParsedResult(user, result, event.replyToken, null, 'photo');
  } catch (err) {
    const isParserErr = err instanceof FoodParserError;
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'webhook.vision.failed',
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
          text: 'ขออภัยค่ะ ยังประมวลผลรูปไม่ได้ ลองส่งใหม่หรือพิมพ์ชื่ออาหารก็ได้นะคะ',
        },
      ],
    });
  }
};

const handleEvent = async (event: WebhookEvent): Promise<void> => {
  if (isTextMessageEvent(event)) {
    await handleTextEvent(event);
    return;
  }
  if (isImageMessageEvent(event)) {
    await handleImageEvent(event);
    return;
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
