---
title: Architecture Overview
description: System diagram, components, and data flow for Tina Diet.
sidebar:
  order: 1
---

Tina Diet has **two user-facing surfaces** (LINE bot chat + LIFF web app)
plus an **operator-facing admin dashboard**, all sharing one Express
backend with SQLite for state. External services: OpenAI for AI, Omise
for payment (currently dormant), and LINE for messaging + auth.

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
                  ┌────────▼────────┐    │  │  /api/v1/admin/*         │   │
                  │   LIFF app      │    │  │  /internal/jobs/*        │   │
                  │ app.tinadiet.com│───▶│  └────────┬─────────────────┘   │
                  │ (Cloudflare     │    │           │                     │
                  │   Workers)      │    │  ┌────────▼────────┐            │
                  └─────────────────┘    │  │ better-sqlite3  │            │
                                         │  │ /data/app.db    │            │
                  ┌─────────────────┐    │  │ + /data/slips/  │            │
                  │  Admin app      │───▶│  │ (volume)        │            │
                  │ admin.tinadiet  │    │  └─────────────────┘            │
                  │   .com          │    │                                 │
                  │ (Cloudflare     │    └────────────────▲────────────────┘
                  │   Workers)      │                     │webhook (dormant)
                  └─────────────────┘            ┌────────┴─────────┐
                  (operators only)               │  Omise API       │
                                                 │  PromptPay +     │
                                                 │  TrueMoney       │
                                                 │  (dormant — KYC) │
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

### Admin dashboard
- A separate React SPA hosted at `admin.tinadiet.com` (Cloudflare Workers
  Static Assets, **different project** from LIFF)
- Email + password login (bcrypt-verified) → 8h JWT with `audience='admin'`
- Operators review manual top-up slips, superadmins also manage settings,
  users, and admin accounts
- Backend routes prefixed `/api/v1/admin/*`, gated by `requireAdmin` and
  `requireSuperadmin` middleware
- Workers.dev URL is disabled — only the custom domain serves the dashboard
  (security hardening, see [Admin overview](/docsfordevtina/admin/overview/))

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
- See [Data model](/docsfordevtina/architecture/data-model/) for schema

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

## Data flow: manual top-up + redeem premium (current primary path)

```
LIFF /premium
  │
  ▼ tap "Top up credit"
LIFF /premium/topup  (pick method: Manual PromptPay)
  │
  ▼ tap Manual
LIFF /premium/topup/manual  (pick amount: 50 / 100 / ... / custom)
  │
  ▼ POST /api/v1/topup/manual/start { amount_thb }
Backend:
  - Validate (not blocked, amount in [min, max], no existing pending)
  - INSERT manual_payments row (status='awaiting_slip')
  - Call promptpay-qr lib → EMVCo payload → QRCode.toDataURL → PNG
  - Return { payment_id, qr_data_url, receiver_name }
  │
  ▼ display QR + amount
User opens bank app (Kasikorn / SCB / Krungthai / ...) → scans QR
  → confirms amount → transfers
  │
  ▼ user returns to LIFF
LIFF: tap "I have transferred" → file picker → upload slip
  │
  ▼ POST /api/v1/topup/manual/:id/upload-slip (multipart)
Backend:
  - Multer validates (MIME, size ≤ 5 MB)
  - Save to /data/slips/<uuid>.<ext>
  - UPDATE manual_payments status='pending' + slip metadata
  │
  ▼ submission visible to operator
Operator at admin.tinadiet.com /payments/pending  (FIFO list)
  │
  ▼ open submission detail
Backend GET /admin/payments/:id/slip
  - Authenticated stream the slip image
  │
  ▼ operator reviews slip + cross-checks bank statement
Operator clicks Approve, enters actual_amount_satang
  │
  ▼ POST /api/v1/admin/payments/:id/approve { actual_amount_satang, ... }
Backend tx:
  - Mark manual_payments status='approved' + credit_granted_satang
  - applyCreditMutation(+actual_amount, source_type='manual_topup')
    → users.credit_balance_satang += amount
    → credit_ledger row INSERT
  - (optional) record abuse flag
  - Return success
  │
  ▼ user sees credit in LIFF /premium "My Wallet"
  ▼ user taps "Redeem Premium 1 month (150 credit)"
  │
  ▼ POST /api/v1/premium/redeem { months: 1 }
Backend tx:
  - applyCreditMutation(-priceCredit, source_type='redeem_premium')
  - Compute newExpiry = max(now, current_expiry) + months
  - userRepository.applyPremium(userId, newExpiry)
  - Return { new_premium_expires_at, credit_balance_satang }
  │
  ▼ LIFF shows "Premium active until …"
```

See [Manual top-up flow](/docsfordevtina/payments/manual-topup/) for full
operator workflow + edge cases.

## Data flow: payment (Omise PromptPay — currently dormant)

The original Omise direct-charge flow is preserved in code (env empty
→ graceful 503) and will reactivate post-KYC. When that happens, the
plan is to refactor the webhook handler to feed the `credit_ledger`
(source_type='omise_topup') instead of granting premium directly.

Until then, see git history at `services/omise.ts` for the legacy flow
implementation. The LIFF "Auto-payment (Omise) — Coming Soon" card on
the topup method picker is the user-facing reminder.

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

- [Data model](/docsfordevtina/architecture/data-model/) — every table
- [Key invariants](/docsfordevtina/architecture/key-invariants/) — patterns
  that must not be broken
- [Backend stack](/docsfordevtina/backend/stack/) — Express conventions
- [LIFF stack](/docsfordevtina/liff/stack/) — React conventions
