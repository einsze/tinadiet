# Backend - AI Nutrition Coach Thailand

Node.js 20 + Express 4 monolith. Handles:
- LINE Messaging API webhook (`/webhook/line`)
- LIFF REST API (`/api/v1/*`)
- Serving the built LIFF SPA in production (`/liff/*` and `/`)
- Background jobs (daily summary push, weekly reports, backups)

## Folder map

```
backend/
  src/
    config/           runtime config (env loader, constants, feature flags)
    routes/
      api/            /api/v1/* (LIFF-facing REST)
      webhook/        /webhook/line, /webhook/stripe, /webhook/line-pay
    middleware/       auth, signature verification, rate limit, error handler
    use-cases/        application-level orchestration (one file per use case)
    services/         cross-cutting services (notifications, payments)
    repositories/     SQLite data access (UserRepository, FoodLogRepository, ...)
    domain/           pure domain types & business rules (BMR/TDEE math, etc.)
    ai/
      prompts/        system prompts for each AI use case
      schemas/        JSON Schema for OpenAI structured outputs
    line/
      flex-templates/ LINE Flex Message JSON templates
    jobs/             node-cron schedulers (daily summary, weekly report, backup)
    errors/           typed error classes
    utils/            shared utilities (date, money, ids)
  db/
    migrations/       hand-written SQL migrations (forward-only)
    seeds/            optional dev seed data
    reference/        curated Thai food reference table (JSON) for AI grounding
  tests/
    unit/             repository + domain tests
    integration/      API + webhook tests
  scripts/            one-shot maintenance scripts (migrate, backup, etc.)
  data/               local SQLite DB + uploaded photos (gitignored)
```

## Required environment

See [`.env.example`](.env.example). Required keys before first run:
- LINE_CHANNEL_ID / SECRET / ACCESS_TOKEN
- LINE_LOGIN_CHANNEL_ID / LIFF_ID
- OPENAI_API_KEY
- SESSION_JWT_SECRET

Stripe / LINE Pay keys can be left blank until Sprint 4.

## Local development (Sprint 1+)

```
cp .env.example .env       # then fill values
npm install
npm run migrate            # apply db/migrations
npm run dev                # express on http://localhost:3000
```

## Production

Deployed on Railway. See [`../ops/railway/`](../ops/railway/) and
[`../docs/02-deployment-runbook.md`](../docs/02-deployment-runbook.md).

## Conventions

- All DB access through repository classes - never raw SQLite in use-cases.
- All AI calls through `src/ai/openai-gateway` - never raw SDK calls elsewhere.
- All times stored UTC, rendered in `Asia/Bangkok` at the API edge.
- Errors thrown as typed `AppError` subclasses; the error middleware maps to HTTP.
