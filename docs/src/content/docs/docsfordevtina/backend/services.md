---
title: Services
description: How services coordinate domain logic, repositories, and external APIs.
sidebar:
  order: 3
---

Services live in `backend/src/services/`. They're the "use-case orchestrator"
layer between routes (HTTP adapters) and repositories (DB access). External
API clients (OpenAI, Omise, Stripe) also live here.

## What belongs in a service

- Coordinating multiple repositories in one logical operation
- Calling external APIs (OpenAI, LINE, Omise, Stripe)
- Computing derived values that need both DB state and API responses
- Throwing custom error types that routes can catch

## What does NOT belong

- Pure functions with no I/O → put in `domain/`
- Single DB query → just use the repository directly from route
- HTTP request/response munging → keep in route handler

## Service catalog

### `food_parser.ts`

Parses food descriptions to structured `food_logs`. Two entry points:

```ts
parseTextToFoodLog(text: string) → ParseResult
parseImageToFoodLog(imageBase64: string) → ParseResult

type ParseResult =
  | { kind: 'items'; items: ParsedItem[] }
  | { kind: 'needs_clarification'; question_th: string }
  | { kind: 'not_food'; reason_th: string };
```

- Uses `gpt-4o-mini` for text, `gpt-4o` for vision (low detail for cost)
- Strict JSON schema in OpenAI request enforces structured output
- SYSTEM_PROMPT enforces Thai output, female register, clarification
  rules ("ข้าวอะไรคะ? ข้าวเปล่า ข้าวผัด หรือข้าวมันไก่?")
- Multi-item parses ("ผัดกะเพรา + ไข่ดาว + น้ำส้ม") return array; each
  becomes a separate `food_logs` row

### `coach.ts`

Generates proactive meal suggestions after each food log.

```ts
generateMealSuggestion(ctx: CoachContext) → Suggestion
```

Context includes: time of day, today's totals so far, daily goals, recent
logs. SYSTEM_PROMPT enforces contextual rules (after heavy main → light
drink, time-of-day appropriate, Thai cuisine first).

Triggered from two places:
1. PATCH `/users/me` first-time profile setup → welcome push with greeting + first suggestion
2. `food_parser` confirmation → suggestion appended to confirmation reply (saves push quota)

### `consultation.ts`

Q&A for nutrition + light exercise questions, premium-gated.

```ts
runConsultation(user: User, question: string, opts?) → ConsultationResult

type ConsultationResult =
  | { kind: 'answered'; user_message, assistant_message, topic, refused, quota }
  | { kind: 'quota_exceeded'; questions_today, limit };
```

- Quota: `CONSULT_DAILY_LIMIT=20` per user per day
- Multi-turn context: last 10 messages within last 120 minutes
- Topic enum: `nutrition | exercise_light | meal_planning | general_wellness | out_of_scope`
- Refusal style: ONE short Thai sentence redirecting
- Same orchestrator called from both LINE webhook AND `POST /api/v1/chat/messages`

### `omise.ts`

Omise payment integration. See [Payments overview](/docsfordevtina/payments/overview/).

```ts
createOmiseCharge(user, method) → CreateChargeResult
retrieveOmiseCharge(chargeId) → OmiseCharge
syncChargeFromOmise(chargeId) → Payment | undefined
handleOmiseEvent(event) → OmiseWebhookResult
parseOmiseWebhookEvent(rawBody) → OmiseEvent
verifyOmiseSignature(rawBody, sigHeader, tsHeader) → boolean
```

- Thin HTTP client (native `fetch`, no SDK)
- HMAC-SHA256 webhook signature verify (base64-decoded secret)
- Grant stacking via `computeGrantWindow(user, days, now)`
- Idempotent webhook (early return if `payment.status === 'successful'`)

### `stripe.ts`

Stripe integration — **dormant** since Sprint 6 payment pivot. Code
preserved for future use (e.g. if SaaS subscription model added later).

When `STRIPE_SECRET_KEY` is empty, all functions throw or routes return
`503 STRIPE_NOT_CONFIGURED`. LIFF hides Stripe-related UI when
`/billing/status` returns `stripe_configured: false`.

## OpenAI client convention

A shared client lives in `backend/src/ai/client.ts`:

```ts
import OpenAI from 'openai';
import { env } from '../config/env.js';

let _client: OpenAI | null = null;

export const openaiClient = (): OpenAI => {
  if (_client !== null) return _client;
  if (env.OPENAI_API_KEY.length === 0) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  _client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: env.OPENAI_TIMEOUT_MS,
  });
  return _client;
};
```

Lazy init (same pattern as repos and stripe). Allows backend to boot
without OPENAI_API_KEY set; the first call to a service that uses OpenAI
will throw.

## When to add a new service

- Logic touches more than one repository
- Logic calls an external API
- Logic is reused across routes + jobs + webhook handlers

Otherwise, keep it inline in the route or push into `domain/`.
