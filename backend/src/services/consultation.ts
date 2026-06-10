import { env } from '../config/env.js';
import { openai } from './openai.js';
import { foodLogsRepository } from '../repositories/food_logs.js';
import { weightLogsRepository } from '../repositories/weight_logs.js';
import { chatMessagesRepository } from '../repositories/chat_messages.js';
import { todayInTimezone } from '../domain/date.js';
import { computeStreakFromDates } from '../domain/streak.js';
import type {
  ChatMessage,
  FoodLog,
  FoodLogTotals,
  User,
  WeightLog,
} from '../domain/types.js';

export type ConsultationResult = {
  answer_th: string;
  refused: boolean;
  topic: ConsultationTopic;
};

export type ConsultationTopic =
  | 'nutrition'
  | 'exercise_light'
  | 'meal_planning'
  | 'general_wellness'
  | 'out_of_scope';

export type ConsultationUsage = {
  input_tokens: number;
  output_tokens: number;
  model: string;
  latency_ms: number;
};

export type ConsultationResponse = {
  result: ConsultationResult;
  usage: ConsultationUsage;
};

export type ConsultationContext = {
  user: User;
  question: string;
  today_totals: FoodLogTotals;
  today_logs: FoodLog[];
  recent_weight_logs: WeightLog[];
  streak_days: number;
  history: ChatMessage[];
};

const JSON_SCHEMA = {
  name: 'tina_consultation_answer',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      answer_th: { type: 'string' },
      refused: { type: 'boolean' },
      topic: {
        type: 'string',
        enum: [
          'nutrition',
          'exercise_light',
          'meal_planning',
          'general_wellness',
          'out_of_scope',
        ],
      },
    },
    required: ['answer_th', 'refused', 'topic'],
  },
} as const;

const SYSTEM_PROMPT = `You are Tina, a warm, evidence-based Thai nutrition coach. Female register with ค่ะ. Answer the user's question using their personal data when relevant.

SCOPE — what you ANSWER:
- Nutrition & food: kcal, macros (protein/carbs/fat), micros, hydration, vitamins, supplements, food choices, portion sizes, Thai dishes, recipes, meal timing, fasting, dietary patterns (keto, low-carb, vegan, etc.), food allergies/intolerances.
- Meal planning tied to the user's goal (loss / maintain / gain) and current intake.
- LIGHT exercise guidance ONLY at a high level — e.g. "for fat loss, combine cardio 3x/week with resistance training", "walking 7-10k steps helps", "strength training preserves lean mass on a cut". Do NOT prescribe detailed workout programs, sets/reps schemes, or rehab.
- General behavior change around eating (cravings, late-night snacking, eating out, meal prep).

SCOPE — what you REFUSE (set refused=true, topic="out_of_scope"):
- Medical diagnosis, disease treatment, prescription meds, dosages, drug interactions.
- Mental health crises, eating disorder treatment (refer to professional gently).
- Anything unrelated: coding, news, gossip, travel tips, relationship advice, sports scores, religion/politics, homework help on non-nutrition subjects.
- Detailed exercise programming (sets×reps, periodization, rehab protocols).

REFUSAL STYLE (when refused=true):
- ONE short Thai sentence that gently redirects: e.g. "เรื่องนี้อยู่นอกที่ Tina ช่วยได้ค่ะ ลองถามเรื่องอาหาร โภชนาการ หรือเป้าหมายลด/เพิ่มน้ำหนักนะคะ" or "ขออภัยค่ะ Tina ดูแลเรื่องโภชนาการเท่านั้น เรื่องนี้ควรปรึกษาแพทย์/ผู้เชี่ยวชาญค่ะ".
- No long apology. No advice that pretends to be nutrition-adjacent.

ANSWER STYLE (when refused=false):
- Thai language always. Female register (ค่ะ, นะคะ).
- Concrete, personal, actionable — reference the user's data when it sharpens the answer (their goal, daily kcal target, today's remaining budget, recent foods, weight trend, streak).
- Length: 2-5 short sentences. No headings, no bullet lists unless answer is genuinely a list of 3+ items. Plain text only.
- Use real numbers from the context when relevant (e.g. "เหลืออีก 600 kcal วันนี้" not "เหลือเยอะ").
- Never fabricate user data you weren't given. If a fact is missing, say so or ask once.
- Don't lecture. Don't moralize. Talk like a friend who happens to be a dietitian.

CONVERSATION HISTORY:
- You may receive recent message history (user + Tina turns from the last couple hours). Use it for follow-up coherence. If the new question is clearly a follow-up, treat it as such.

TOPIC FIELD: pick the single best topic for telemetry. "out_of_scope" only when refused=true.

Output: structured JSON per schema. No prose outside fields.`;

const formatProfileLine = (u: User): string => {
  const parts: string[] = [];
  if (u.gender !== null) parts.push(`gender=${u.gender}`);
  if (u.date_of_birth !== null) parts.push(`dob=${u.date_of_birth}`);
  if (u.height_cm !== null) parts.push(`height=${u.height_cm}cm`);
  if (u.current_weight_kg !== null)
    parts.push(`current_weight=${u.current_weight_kg}kg`);
  if (u.target_weight_kg !== null)
    parts.push(`target_weight=${u.target_weight_kg}kg`);
  if (u.activity_level !== null) parts.push(`activity=${u.activity_level}`);
  if (u.goal_type !== null) parts.push(`goal=${u.goal_type}`);
  return parts.length > 0 ? parts.join(', ') : '(profile not set)';
};

const formatGoalsLine = (u: User): string => {
  if (u.daily_calorie_goal === null) return '(daily goals not computed yet)';
  return `daily_calorie_goal=${u.daily_calorie_goal} kcal · protein=${u.daily_protein_g ?? '?'}g · carbs=${u.daily_carbs_g ?? '?'}g · fat=${u.daily_fat_g ?? '?'}g`;
};

const formatTodayLogs = (logs: FoodLog[]): string => {
  if (logs.length === 0) return '  (none yet today)';
  return logs
    .slice(0, 8)
    .map((log, i) => {
      const name = log.food_name_th ?? log.food_name_en ?? 'อาหาร';
      return `  ${i + 1}. ${name} — ${Math.round(log.kcal)} kcal · ${Math.round(log.protein_g)}p/${Math.round(log.carbs_g)}c/${Math.round(log.fat_g)}f`;
    })
    .join('\n');
};

const formatWeightTrend = (logs: WeightLog[]): string => {
  if (logs.length === 0) return '(no weight logs yet)';
  if (logs.length === 1) {
    const w = logs[0]!;
    return `latest=${w.weight_kg}kg on ${w.date}`;
  }
  const latest = logs[0]!;
  const earliest = logs[logs.length - 1]!;
  const delta = latest.weight_kg - earliest.weight_kg;
  const sign = delta > 0 ? '+' : '';
  return `latest=${latest.weight_kg}kg (${latest.date}) · ${logs.length} logs over period · trend ${sign}${delta.toFixed(1)}kg vs ${earliest.weight_kg}kg (${earliest.date})`;
};

const formatPromptContext = (ctx: ConsultationContext): string => {
  const u = ctx.user;
  const remaining =
    u.daily_calorie_goal !== null
      ? `${Math.max(u.daily_calorie_goal - ctx.today_totals.kcal, 0)} kcal remaining today`
      : 'remaining=unknown (no daily goal set)';
  const lines: string[] = [
    `profile: ${formatProfileLine(u)}`,
    `goals: ${formatGoalsLine(u)}`,
    `today_consumed: ${ctx.today_totals.kcal} kcal · ${ctx.today_totals.protein_g}p/${ctx.today_totals.carbs_g}c/${ctx.today_totals.fat_g}f (${ctx.today_totals.count} items) · ${remaining}`,
    `today_logs (oldest first):`,
    formatTodayLogs(ctx.today_logs),
    `weight: ${formatWeightTrend(ctx.recent_weight_logs)}`,
    `streak_days: ${ctx.streak_days}`,
  ];
  if (ctx.history.length > 0) {
    lines.push('recent_chat_history (oldest first):');
    for (const m of ctx.history) {
      const who = m.role === 'user' ? 'user' : 'tina';
      const truncated =
        m.content.length > 280 ? `${m.content.slice(0, 280)}…` : m.content;
      lines.push(`  ${who}: ${truncated}`);
    }
  }
  lines.push('');
  lines.push(`new_user_question: ${ctx.question}`);
  return lines.join('\n');
};

export class ConsultationError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ConsultationError';
  }
}

export type RunConsultationOutcome =
  | { kind: 'answered'; user_message: ChatMessage; assistant_message: ChatMessage; topic: ConsultationTopic; refused: boolean; questions_today: number; limit: number; usage: ConsultationUsage }
  | { kind: 'quota_exceeded'; questions_today: number; limit: number };

export type RunConsultationInput = {
  user: User;
  question: string;
};

export const runConsultation = async (
  input: RunConsultationInput
): Promise<RunConsultationOutcome> => {
  const { user, question } = input;
  const today = todayInTimezone(user.timezone);
  const questionsToday = chatMessagesRepository.countQuestionsToday(
    user.id,
    today
  );

  if (questionsToday >= env.CONSULT_DAILY_LIMIT) {
    return {
      kind: 'quota_exceeded',
      questions_today: questionsToday,
      limit: env.CONSULT_DAILY_LIMIT,
    };
  }

  const userMessage = chatMessagesRepository.append({
    user_id: user.id,
    user_timezone: user.timezone,
    role: 'user',
    content: question,
    refused: false,
  });

  const totals = foodLogsRepository.totalsByUserAndDate(user.id, today);
  const todayLogs = foodLogsRepository.listByUserAndDate(user.id, today);
  const recentWeights = weightLogsRepository.listRecent(user.id, 14);
  const recentDates = foodLogsRepository.distinctLogDatesRecent(
    user.id,
    today,
    30
  );
  const streak = computeStreakFromDates(recentDates, today);
  const windowMessages = chatMessagesRepository.listRecentWindow(
    user.id,
    env.CONSULT_HISTORY_MINUTES,
    env.CONSULT_HISTORY_MAX_MESSAGES
  );
  const history = windowMessages.slice(0, -1);

  const { result, usage } = await generateConsultationAnswer({
    user,
    question,
    today_totals: totals,
    today_logs: todayLogs,
    recent_weight_logs: recentWeights,
    streak_days: streak,
    history,
  });

  const assistantMessage = chatMessagesRepository.append({
    user_id: user.id,
    user_timezone: user.timezone,
    role: 'assistant',
    content: result.answer_th,
    refused: result.refused,
  });

  return {
    kind: 'answered',
    user_message: userMessage,
    assistant_message: assistantMessage,
    topic: result.topic,
    refused: result.refused,
    questions_today: questionsToday + 1,
    limit: env.CONSULT_DAILY_LIMIT,
    usage,
  };
};

export const generateConsultationAnswer = async (
  ctx: ConsultationContext
): Promise<ConsultationResponse> => {
  const startedAt = Date.now();
  try {
    const completion = await openai().chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: formatPromptContext(ctx) },
      ],
      response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
      max_tokens: 500,
      temperature: 0.4,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message.content) {
      throw new ConsultationError('OpenAI returned no content');
    }
    const result = JSON.parse(choice.message.content) as ConsultationResult;
    const usage: ConsultationUsage = {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
      model: completion.model,
      latency_ms: Date.now() - startedAt,
    };
    return { result, usage };
  } catch (err) {
    if (err instanceof ConsultationError) throw err;
    throw new ConsultationError(
      err instanceof Error ? err.message : String(err),
      err
    );
  }
};
