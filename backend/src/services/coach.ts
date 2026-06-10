import { env } from '../config/env.js';
import { openai } from './openai.js';
import type { FoodLog, FoodLogTotals, User } from '../domain/types.js';

export type CoachSuggestionResult = {
  main_name_th: string;
  main_name_en: string | null;
  main_kcal_low: number;
  main_kcal_high: number;
  main_rationale_th: string;
  alternative_name_th: string | null;
  alternative_kcal_low: number | null;
  alternative_kcal_high: number | null;
};

export type CoachSuggestionUsage = {
  input_tokens: number;
  output_tokens: number;
  model: string;
  latency_ms: number;
};

export type CoachSuggestionResponse = {
  result: CoachSuggestionResult;
  usage: CoachSuggestionUsage;
};

export type CoachTrigger = 'welcome' | 'after_log';

export type CoachContext = {
  user: User;
  trigger: CoachTrigger;
  current_hour_local: number;
  today_totals: FoodLogTotals;
  recent_logs: FoodLog[];
  just_eaten_kcal: number | null;
};

const JSON_SCHEMA = {
  name: 'coach_meal_suggestion',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      main_name_th: { type: 'string' },
      main_name_en: { type: ['string', 'null'] },
      main_kcal_low: { type: 'number' },
      main_kcal_high: { type: 'number' },
      main_rationale_th: { type: 'string' },
      alternative_name_th: { type: ['string', 'null'] },
      alternative_kcal_low: { type: ['number', 'null'] },
      alternative_kcal_high: { type: ['number', 'null'] },
    },
    required: [
      'main_name_th',
      'main_name_en',
      'main_kcal_low',
      'main_kcal_high',
      'main_rationale_th',
      'alternative_name_th',
      'alternative_kcal_low',
      'alternative_kcal_high',
    ],
  },
} as const;

const SYSTEM_PROMPT = `You are Tina, a warm friendly Thai nutrition coach. Female register with ค่ะ. Suggest the next meal/snack/drink for the user — feel human and personal, never robotic.

Inputs you receive:
- profile: gender, age, height_cm, weight, target weight, activity level, goal (loss/maintain/gain)
- daily_calorie_goal + macro targets
- today_consumed (kcal + protein + carbs + fat so far)
- recent_logs (what they ate today, latest first; empty if first time)
- current_hour_local (0-23, in user's timezone)
- trigger: "welcome" (first profile setup, no logs yet) or "after_log" (just logged something)

Rules:
- Suggest exactly ONE main item + ONE alternative.
- Decide item type CONTEXTUALLY:
  * after heavy main course → suggest light drink, fruit, or salad (NOT another heavy meal)
  * after light snack → suggest something more substantial if there's room in budget
  * morning hours (5-10) → breakfast-y
  * lunch hours (11-14) → main meal
  * afternoon (15-17) → snack
  * evening (18-21) → dinner if budget remains, otherwise light
  * late (22-04) → light only
- Respect remaining budget: kcal_low + kcal_high should fit within (daily_calorie_goal - today_consumed.kcal). If they're over budget already, suggest the lightest sensible option (water, plain tea, single piece of fruit) with rationale acknowledging it.
- Balance macros: if today_consumed.protein < 50% of goal, lean protein-rich. If carbs already over goal, low-carb. If fat under goal, can include healthy fats.
- Thai cuisine first. Use real Thai dish names (อกไก่ย่าง, สลัดทูน่า, ส้มตำไทยไม่ใส่น้ำตาล, ไก่ต้มสมุนไพร, etc.). International options OK as alternative if natural.
- main_rationale_th = ONE short Thai sentence explaining WHY this fits (1-2 specific reasons: macros + context). Examples:
  "เพิ่มโปรตีน 25g และเบาท้องหลังมื้อใหญ่"
  "เหลือ 800 kcal วันนี้ ลองนี่เพื่อปิดวันสบายๆ"
  "หลังของมัน ขอเย็นๆ ล้างปาก"

Output format: structured JSON per schema. No prose outside fields.`;

const formatPromptContext = (ctx: CoachContext): string => {
  const u = ctx.user;
  const recentLines = ctx.recent_logs.slice(0, 6).map((log, i) => {
    const name = log.food_name_th ?? log.food_name_en ?? 'อาหาร';
    return `  ${i + 1}. ${name} — ${Math.round(log.kcal)} kcal · ${Math.round(log.protein_g)}p/${Math.round(log.carbs_g)}c/${Math.round(log.fat_g)}f${log.source === 'photo' ? ' (photo)' : ''}`;
  });
  return [
    `trigger: ${ctx.trigger}`,
    `current_hour_local: ${ctx.current_hour_local}`,
    `profile: gender=${u.gender ?? '?'}, height=${u.height_cm ?? '?'}cm, weight=${u.current_weight_kg ?? '?'}kg, target=${u.target_weight_kg ?? '?'}kg, activity=${u.activity_level ?? '?'}, goal=${u.goal_type ?? '?'}`,
    `daily_calorie_goal: ${u.daily_calorie_goal ?? '?'} kcal · protein ${u.daily_protein_g ?? '?'}g · carbs ${u.daily_carbs_g ?? '?'}g · fat ${u.daily_fat_g ?? '?'}g`,
    `today_consumed: ${ctx.today_totals.kcal} kcal · ${ctx.today_totals.protein_g}p/${ctx.today_totals.carbs_g}c/${ctx.today_totals.fat_g}f (${ctx.today_totals.count} items)`,
    ctx.just_eaten_kcal !== null
      ? `just_eaten_kcal: ${Math.round(ctx.just_eaten_kcal)}`
      : 'just_eaten_kcal: null',
    'recent_logs (latest first):',
    recentLines.length > 0 ? recentLines.join('\n') : '  (none)',
  ].join('\n');
};

export class CoachError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CoachError';
  }
}

export const generateMealSuggestion = async (
  ctx: CoachContext
): Promise<CoachSuggestionResponse> => {
  const startedAt = Date.now();
  try {
    const completion = await openai().chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: formatPromptContext(ctx) },
      ],
      response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
      max_tokens: 400,
      temperature: 0.5,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message.content) {
      throw new CoachError('OpenAI returned no content');
    }
    const result = JSON.parse(choice.message.content) as CoachSuggestionResult;
    const usage: CoachSuggestionUsage = {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
      model: completion.model,
      latency_ms: Date.now() - startedAt,
    };
    return { result, usage };
  } catch (err) {
    if (err instanceof CoachError) throw err;
    throw new CoachError(
      err instanceof Error ? err.message : String(err),
      err
    );
  }
};

export const formatSuggestionForReply = (
  result: CoachSuggestionResult
): string => {
  const mainKcal =
    result.main_kcal_low === result.main_kcal_high
      ? `${Math.round(result.main_kcal_low)} kcal`
      : `${Math.round(result.main_kcal_low)}-${Math.round(result.main_kcal_high)} kcal`;
  const mainName = result.main_name_en
    ? `${result.main_name_th} (${result.main_name_en})`
    : result.main_name_th;
  const lines: string[] = [
    '💡 แนะนำต่อไป',
    `${mainName} · ${mainKcal}`,
    result.main_rationale_th,
  ];
  if (
    result.alternative_name_th !== null &&
    result.alternative_kcal_low !== null &&
    result.alternative_kcal_high !== null
  ) {
    const altKcal =
      result.alternative_kcal_low === result.alternative_kcal_high
        ? `${Math.round(result.alternative_kcal_low)} kcal`
        : `${Math.round(result.alternative_kcal_low)}-${Math.round(result.alternative_kcal_high)} kcal`;
    lines.push(`หรือลอง: ${result.alternative_name_th} · ${altKcal}`);
  }
  return lines.join('\n');
};

export const currentHourInTimezone = (
  timezone: string,
  now: Date = new Date()
): number => {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    const h = hourPart !== undefined ? Number(hourPart) : now.getUTCHours();
    return Number.isFinite(h) ? h % 24 : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
};
