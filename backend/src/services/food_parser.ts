import { env } from '../config/env.js';
import { openai } from './openai.js';
import type { MealType } from '../domain/types.js';

export type FoodParserResult = {
  is_food: boolean;
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text: string | null;
  meal_type: MealType | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
  reason: string | null;
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

Your task: parse a single chat message and decide if it describes a food the user just ate. If yes, estimate Thai-portion nutrition values; if no, reply with is_food=false and a short reason.

Rules:
- Thai food is your specialty. Recognize common Thai dishes by name (ข้าวผัด, ผัดกะเพรา, ส้มตำ, ต้มยำ, ก๋วยเตี๋ยว, etc.).
- Estimate values for one standard Thai serving unless the user specifies a quantity.
- If quantity is given (e.g. "2 plates", "100g", "1 bowl"), scale the values.
- Use realistic kcal/macros; never invent or guess wildly.
- If the message is a greeting, question, command, or anything not about food just eaten, set is_food=false with a short reason.
- Provide both Thai and English names when known. Use null when you don't know one.
- meal_type: infer from time-of-day cues in the message if any (e.g. "breakfast"), else null.
- confidence: 0.0 to 1.0 reflecting your certainty.

Never give medical advice. Stay short and factual.`;

const JSON_SCHEMA = {
  name: 'food_parser_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      is_food: { type: 'boolean' },
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
      reason: { type: ['string', 'null'] },
    },
    required: [
      'is_food',
      'food_name_th',
      'food_name_en',
      'quantity_text',
      'meal_type',
      'kcal',
      'protein_g',
      'carbs_g',
      'fat_g',
      'confidence',
      'reason',
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
      max_tokens: 250,
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
