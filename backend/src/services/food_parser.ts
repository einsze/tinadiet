import { env } from '../config/env.js';
import { openai } from './openai.js';
import type { MealType } from '../domain/types.js';

export type FoodParserItem = {
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text: string | null;
  meal_type: MealType | null;
  kcal: number;
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
- kcal, protein_g, carbs_g, fat_g = realistic values for the consumed
  quantity (scale by quantity_text). Be conservative; never guess wildly.
- confidence = 0.0 to 1.0.

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
