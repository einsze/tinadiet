import { env } from '../config/env.js';
import { openai } from './openai.js';
import type { MealType } from '../domain/types.js';

export type FoodParserItem = {
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text: string | null;
  meal_type: MealType | null;
  kcal: number;
  kcal_low: number;
  kcal_high: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
};

export type FoodParserResult = {
  is_food: boolean;
  needs_clarification: boolean;
  clarification_question: string | null;
  reason: string | null;
  items: FoodParserItem[];
};

export type FoodParserUsage = {
  input_tokens: number;
  output_tokens: number;
  model: string;
  latency_ms: number;
};

export type FoodParserResponse = {
  result: FoodParserResult;
  usage: FoodParserUsage;
};

const SYSTEM_PROMPT = `You are Tina, a friendly Thai nutrition coach.

Your job: parse a single chat message that may describe what the user just ate.

Output one of three states (mutually exclusive):

A) NOT food (greeting, command, complaint, random text):
   is_food=false, needs_clarification=false, items=[],
   reason=short Thai sentence (e.g. "นั่นไม่ใช่อาหารนะ", "บอกชื่ออาหารที่ทานหน่อย").

B) Food but TOO VAGUE to estimate (e.g. "ข้าว", "rice", "soup", "noodles",
   "ขนม", "lunch", "อาหารเย็น", "ate a lot"):
   is_food=true, needs_clarification=true, items=[],
   clarification_question=short Thai question listing examples
   (e.g. "ข้าวอะไรคะ? ข้าวเปล่า ข้าวผัด หรือข้าวมันไก่?",
         "ขนมอะไรคะ? คุกกี้ เค้ก หรือขนมไทย?",
         "ก๋วยเตี๋ยวอะไรคะ? ก๋วยเตี๋ยวเรือ ราดหน้า หรือผัดซีอิ๊ว?").
   DO NOT fabricate nutrition values when the food is too vague.

C) Food specific enough to estimate (single dish or multiple):
   is_food=true, needs_clarification=false,
   items = array with ONE entry per distinct dish. ALWAYS return at least
   one item in this state. If the user listed multiple foods (e.g.
   "ผัดกะเพรา + ไข่ดาว + น้ำส้ม", "pad thai and a coke"), return one
   item per food.

Per-item rules:
- food_name_th = name in Thai (always fill if you can).
- food_name_en = English transliteration / translation.
- quantity_text = the exact quantity phrase if user gave one ("2 จาน",
  "100g", "1 bowl"), else null. Default = one standard Thai serving.
- meal_type = infer from cues in the message if any, else null.
- kcal = best mid-point estimate for the portion you assume.
- kcal_low and kcal_high = realistic range bounds reflecting portion
  uncertainty. Rules of thumb:
  * tight range (kcal_high - kcal_low ≤ kcal * 0.15) when the user gave
    explicit quantity ("100g", "1 piece") or the dish is very standardized
    ("1 banana").
  * wider range (≤ kcal * 0.40) for ambiguous Thai dish photos where
    portion is hard to judge (one plate could be small or generous).
  * Always satisfy: kcal_low ≤ kcal ≤ kcal_high. Never invert.
- protein_g, carbs_g, fat_g = single point estimate at the same mid kcal.
  Do not range these — macros stay stable per gram of food.
- confidence = 0.0 to 1.0 reflecting your overall certainty.

Language rules:
- food_name_th, reason, clarification_question MUST be in Thai.
- food_name_en is short English. Never Indonesian or other languages.

Never give medical advice. Stay short and factual.`;

const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    food_name_th: { type: ['string', 'null'] },
    food_name_en: { type: ['string', 'null'] },
    quantity_text: { type: ['string', 'null'] },
    meal_type: {
      type: ['string', 'null'],
      enum: ['breakfast', 'lunch', 'dinner', 'snack', null],
    },
    kcal: { type: 'number' },
    kcal_low: { type: 'number' },
    kcal_high: { type: 'number' },
    protein_g: { type: 'number' },
    carbs_g: { type: 'number' },
    fat_g: { type: 'number' },
    confidence: { type: 'number' },
  },
  required: [
    'food_name_th',
    'food_name_en',
    'quantity_text',
    'meal_type',
    'kcal',
    'kcal_low',
    'kcal_high',
    'protein_g',
    'carbs_g',
    'fat_g',
    'confidence',
  ],
} as const;

const JSON_SCHEMA = {
  name: 'food_parser_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_food: { type: 'boolean' },
      needs_clarification: { type: 'boolean' },
      clarification_question: { type: ['string', 'null'] },
      reason: { type: ['string', 'null'] },
      items: { type: 'array', items: ITEM_SCHEMA },
    },
    required: [
      'is_food',
      'needs_clarification',
      'clarification_question',
      'reason',
      'items',
    ],
  },
} as const;

export class FoodParserError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'FoodParserError';
  }
}

export const parseTextToFoodLog = async (
  text: string
): Promise<FoodParserResponse> => {
  const startedAt = Date.now();
  try {
    const completion = await openai().chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: JSON_SCHEMA,
      },
      max_tokens: 600,
      temperature: 0.2,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message.content) {
      throw new FoodParserError('OpenAI returned no content');
    }

    const result = JSON.parse(choice.message.content) as FoodParserResult;
    const usage: FoodParserUsage = {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
      model: completion.model,
      latency_ms: Date.now() - startedAt,
    };

    return { result, usage };
  } catch (err) {
    if (err instanceof FoodParserError) throw err;
    throw new FoodParserError(
      err instanceof Error ? err.message : String(err),
      err
    );
  }
};

const VISION_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

Vision-specific instructions:
- The user is sending a photo of food they ate (or are about to eat).
- Identify every distinct dish visible in the image and return one item per dish.
- Estimate portion based on what is visible in the photo (plate size cues, common Thai serving sizes).
- If the image is blurry / not food / unclear → is_food=false (or needs_clarification=true if it might be food but ambiguous).

Visual disambiguation for commonly confused Thai dishes — use these cues BEFORE naming the dish:

PORK-ON-RICE family (very commonly confused):
- ข้าวขาหมู (Khao Kha Moo / pork leg rice): BRAISED pork leg/hock, DARK GLOSSY BROWN gravy, SOFT fall-apart meat (no crispy skin), typically served with Chinese greens (cai lan/kale/morning glory) and sometimes boiled egg + pickled mustard greens. NO red color on meat.
- ข้าวหมูแดง (Khao Moo Daeng / red BBQ pork rice): roast pork SLICES with distinctly RED edges/glaze (from red fermented bean paste), drizzled with thin sweet-savory red-brown sauce, almost always served with cucumber + boiled egg. KEY signal: visible RED color on the pork edges or surface.
- ข้าวหมูกรอบ (Khao Moo Krob / crispy pork rice): cubed pork belly with CRISPY golden skin clearly separated from the white meat layer below; dark sweet dipping sauce on side.
- ข้าวขาหมู vs ข้าวหมูแดง decision rule: if pork is sliced and shows RED edges → moo daeng. If pork is chunky/whole leg and brown gravy → kha moo.

CHICKEN-ON-RICE family:
- ข้าวมันไก่ (Khao Man Gai): POACHED white/pale chicken (not roasted, not fried), yellowish oil-cooked rice, ginger + chili dipping sauce on side.
- ข้าวหน้าไก่: stewed chicken pieces in brown gravy over rice (different from poached khao man gai).
- ไก่ทอด vs ไก่ย่าง: fried (uniformly golden crispy crust, often battered) vs grilled (visible char lines, no batter).

OTHER common confusions:
- ผัดกะเพรา: visible WHOLE basil leaves stir-fried in, dark brown sauce, typically over rice with fried egg.
- ผัดไทย: orange-tinted thin rice noodles with bean sprouts, lime wedge, crushed peanuts, often shrimp/egg/tofu.
- ก๋วยเตี๋ยวเรือ vs ก๋วยเตี๋ยวต้มยำ: boat noodle has DARK MURKY broth; tom yum noodle has RED-ORANGE broth with chili oil + herbs floating.
- ส้มตำ: shredded GREEN papaya base with chili, lime, fish sauce; brownish-red dressing visible.

Confidence & clarification rule (IMPORTANT — applies to vision input):
- For each dish, mentally check 2-3 visual features that distinguish it from look-alikes BEFORE writing the name.
- If two or more dishes are plausible AND you cannot pick one confidently (your confidence would be < 0.65), DO NOT guess. Instead set is_food=true, needs_clarification=true, items=[], and put the question in clarification_question naming the top 2 candidates: e.g. "ใช่ข้าวขาหมูหรือข้าวหมูแดงคะ?" or "ใช่ไก่ทอดหรือไก่ย่างคะ?".
- It is much better to ask than to log a wrong dish — users hate seeing wrong food in their tracker, and a clarification round is cheap.`;

export const parseImageToFoodLog = async (
  imageBase64: string,
  mimeType: string,
  caption?: string
): Promise<FoodParserResponse> => {
  const startedAt = Date.now();
  try {
    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
    > = [
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`,
          detail: env.OPENAI_VISION_DETAIL,
        },
      },
    ];
    if (caption !== undefined && caption.length > 0) {
      userContent.unshift({ type: 'text', text: caption });
    }

    const completion = await openai().chat.completions.create({
      model: env.OPENAI_VISION_MODEL,
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: JSON_SCHEMA,
      },
      max_tokens: 600,
      temperature: 0.2,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message.content) {
      throw new FoodParserError('OpenAI vision returned no content');
    }

    const result = JSON.parse(choice.message.content) as FoodParserResult;
    const usage: FoodParserUsage = {
      input_tokens: completion.usage?.prompt_tokens ?? 0,
      output_tokens: completion.usage?.completion_tokens ?? 0,
      model: completion.model,
      latency_ms: Date.now() - startedAt,
    };

    return { result, usage };
  } catch (err) {
    if (err instanceof FoodParserError) throw err;
    throw new FoodParserError(
      err instanceof Error ? err.message : String(err),
      err
    );
  }
};
