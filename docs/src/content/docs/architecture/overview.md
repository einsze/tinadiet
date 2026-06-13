---
title: Architecture Overview
description: System diagram, components, and data flow for Tina Diet.
sidebar:
  order: 1
---

Tina Diet has two user-facing surfaces (LINE bot chat + LIFF web app) sharing
one backend, with SQLite for state and three external services for AI,
payment, and event delivery.

## System diagram

```
                                                ┌──────────────────┐
                                                │  OpenAI API      │
                                                │  gpt-4o,         │
                                                │  gpt-4o-mini     │
                                                └─────────▲────────┘
                                                          │
                  ┌─────────────────┐    ┌────────────────┴────────────────┐
                  │ LINE Messaging  │    │                                 │
                  │ API (Cloud)     │◀──▶│                                 │
                  └────────▲────────┘    │     Railway backend             │
                           │             │     api.tinadiet.com            │
                           │webhook      │                                 │
                  ┌────────┴────────┐    │  ┌──────────────────────────┐   │
                  │   User on LINE  │    │  │  Express                 │   │
                  │   (Thai phone)  │    │  │  /webhook/line           │   │
                  └────────┬────────┘    │  │  /webhooks/omise         │   │
                           │             │  │  /api/v1/*               │   │
                  ┌────────▼────────┐    │  │  /internal/jobs/*        │   │
                  │   LIFF app      │    │  └────────┬─────────────────┘   │
                  │ app.tinadiet.com│───▶│           │                     │
                  │ (Cloudflare     │    │  ┌────────▼────────┐            │
                  │   Workers)      │    │  │ better-sqlite3  │            │
                  └─────────────────┘    │  │ /data/app.db    │            │
                                         │  │ (volume)        │            │
                                         │  └─────────────────┘            │
                                         └────────────────▲────────────────┘
                                                          │webhook
                                                ┌─────────┴────────┐
                                                │  Omise API       │
                                                │  PromptPay +     │
                                                │  TrueMoney       │
                                                └──────────────────┘
```

## Components

### LINE bot chat surface
- User sends a message in LINE → LINE webhook → `POST /webhook/line` on backend
- Backend signature-verifies, classifies intent (greeting / show-logs /
  log-weight / consult / parse), runs handler, replies via LINE Reply API
- Push messages: backend → LINE Push API for daily/weekly summaries,
  renewal reminders, welcome message

### LIFF (LINE Front-end Framework) app
- A React SPA hosted at `app.tinadiet.com` (Cloudflare Workers Static Assets)
- Loaded by LINE app's embedded webview, gets the user's `lineUserId` via
  LIFF SDK
- Exchanges `lineUserId` for a backend session JWT at `/api/v1/auth/exchange`
- All subsequent API calls authenticate with `Authorization: Bearer <jwt>`

### Backend (Railway)
- Single Express process, Node 22 ESM, `tsx watch` for dev
- Mounted routers in order (order matters for express.json body parser):
  1. `/webhook/line` — express.json (after sig verify)
  2. `/webhooks/stripe` — express.raw (dormant)
  3. `/webhooks/omise` — express.raw (for HMAC sig verify)
  4. CORS for `/api/v1`
  5. `express.json` global
  6. `/api/v1/*` — all LIFF-facing API
  7. `/internal/jobs/*` — cron triggers (x-jobs-secret guarded)
  8. `/healthz` — public health check
- Cron jobs (node-cron, Asia/Bangkok timezone):
  - `0 21 * * *` daily summary
  - `0 8 * * 1` weekly summary (Monday morning)
  - `0 2 * * *` expire premium

### SQLite database
- File at `/data/app.db` on Railway volume (`backend-volume`, 1 GB)
- Accessed synchronously via `better-sqlite3` — no async/await for queries
- Migrations applied at boot via `runMigrations()` (idempotent)
- See [Data model](/documentation/architecture/data-model/) for schema

### External services
- **OpenAI** — text parsing (food logs from chat), vision parsing (food
  photos), coach suggestions, consultation Q&A
- **Omise** — PromptPay QR + TrueMoney Wallet charges + webhooks
- **LINE Cloud** — Messaging API (bot) + Login API (LIFF auth)

## Data flow: AI food log via chat

1. User sends "ผัดกะเพราไก่ + ไข่ดาว" in LINE
2. LINE → POST /webhook/line (signed request)
3. Backend verifies signature, parses event, classifies intent → `attempt_parse`
4. Backend calls OpenAI `gpt-4o-mini` with system prompt + user text +
   strict JSON schema
5. AI returns `{ items: [{food_name_th: 'ผัดกะเพราไก่', kcal: 450, ...},
   {food_name_th: 'ไข่ดาว', kcal: 90, ...}] }` (or `needs_clarification` /
   `not_food`)
6. Backend inserts each item into `food_logs` table
7. Backend asks for proactive meal suggestion via `coach.ts` (also OpenAI)
8. Backend replies to LINE with confirmation + suggestion in single message

## Data flow: payment (Omise PromptPay)

1. User taps "Premium" in LIFF Rich Menu → PremiumSection
2. User picks PromptPay, taps "ชำระ 150 ฿"
3. LIFF POST `/api/v1/billing/omise/charge` body `{method:"promptpay"}`
4. Backend calls Omise API `POST /charges` with source.type=promptpay
5. Omise creates charge, returns `qr_image_uri`
6. Backend inserts `payments` row (status=pending), returns charge to LIFF
7. LIFF shows QR modal with countdown + polls `GET /omise/charge/:id` every
   2 seconds
8. Meanwhile Omise fires `charge.create` webhook → backend ACKs (no grant)
9. User scans QR in bank app, pays
10. Omise fires `charge.complete` webhook with HMAC signature
11. Backend verifies signature, marks payment successful, extends
    `users.premium_expires_at` (stacks if user was already premium)
12. LIFF polling sees new status → modal transitions to success → reload
    billing status

## Where things live

| Concept | Path |
|---|---|
| Database schema | `backend/src/db/migrations.ts` |
| Repositories | `backend/src/repositories/` |
| HTTP routes | `backend/src/routes/{api,webhook,internal}/` |
| Domain logic | `backend/src/domain/` |
| AI services | `backend/src/services/{food_parser,coach,consultation}.ts` |
| Payment service | `backend/src/services/{omise,stripe}.ts` |
| Background jobs | `backend/src/jobs/` |
| LIFF pages | `liff/src/pages/` |
| LIFF components | `liff/src/components/` |
| LIFF API client | `liff/src/api/` |
| Brand assets | `liff/public/` |

## Read next

- [Data model](/documentation/architecture/data-model/) — every table
- [Key invariants](/documentation/architecture/key-invariants/) — patterns
  that must not be broken
- [Backend stack](/documentation/backend/stack/) — Express conventions
- [LIFF stack](/documentation/liff/stack/) — React conventions
