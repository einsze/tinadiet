---
title: Introduction
description: What Tina Diet is, who it's for, and the technical stack at a glance.
sidebar:
  order: 1
---

**Tina Diet** is a Thai-first AI nutrition coach delivered through a LINE
Official Account and an embedded LIFF (LINE Front-end Framework) app. End-users
log food via natural-language chat or photos, track macros against goals
computed from their profile, and ask nutrition questions with a 20/day quota
on the premium tier.

This site is **developer documentation** — for the project owner and future
collaborators. End-user help lives in the LIFF SupportPage.

## High-level value

- **Log food the easy way** — text ("ผัดกะเพราไก่ + ไข่ดาว"), photo (premium),
  or manual form. AI parses to kcal + macros, asks for clarification when
  ambiguous ("ข้าวอะไรคะ?").
- **Personalized goals** — BMR/TDEE via Mifflin-St Jeor from gender, age,
  height, weight, activity level, and goal type (lose / maintain / gain).
- **Coaching** — proactive meal suggestions after each log + on-demand
  consultation Q&A (premium).
- **Daily + weekly summaries** — push via LINE at 21:00 ICT (daily) and
  Monday 08:00 ICT (weekly).
- **Streak motivation** — fire emoji badge after 2+ consecutive days.

## Repo layout

The repository at [`github.com/einsze/tinadiet`](https://github.com/einsze/tinadiet)
is a monorepo:

```
tinadiet/
├── projects/
│   ├── backend/      Express + better-sqlite3 + LINE SDK + OpenAI + Omise
│   ├── liff/         Vite + React + Tailwind, deployed to Cloudflare Workers
│   ├── docs/         Astro Starlight (this site)
│   └── ops/          Operational runbooks (markdown only, no deploy)
└── README.md
```

Each `projects/<name>/` is independently buildable and deployable. They share
git history but have separate `package.json` and dependency trees.

## Technology summary

| Layer | Choice | Notes |
|---|---|---|
| Bot platform | LINE Messaging API + LIFF | Thai market reality |
| Backend runtime | Node.js 22 LTS, ESM | TypeScript with `tsx` for dev |
| Web framework | Express 4 | Pragmatic, well-understood |
| Database | better-sqlite3 + SQLite file on Railway volume | Sync queries; lazy stmts pattern |
| Validation | Zod 4 | All API inputs |
| Session | `jsonwebtoken` | HS256 over `SESSION_JWT_SECRET` |
| AI | OpenAI SDK v6 (`gpt-4o-mini`, `gpt-4o`) | Strict JSON schema for parsers |
| Payments | Omise REST (no SDK) | Stripe code dormant |
| Frontend | Vite 5 + React 18 + Tailwind 3 | `@line/liff` v2 |
| Routing | `react-router-dom` v6 | Multi-page LIFF |
| Icons | `lucide-react` | Match Rich Menu style |
| Cron | `node-cron` | Daily summary, weekly summary, expire premium |
| Hosting (backend) | Railway (Singapore, Hobby) | Volume mounted at `/data` |
| Hosting (LIFF) | Cloudflare Workers Static Assets | SPA fallback config |
| Hosting (docs) | Cloudflare Pages | Astro + Starlight |
| Registrar | Cloudflare Registrar | `tinadiet.com` |

## Brand & UX invariants

These shape almost every product decision. Don't break them without
discussion:

1. **Thai-first content, English navigation chrome.** User-facing text
   (Tina's replies, coaching, food parsing) is in Thai with the polite
   female `ค่ะ` register. Navigation labels (Home / Premium / Profile /
   Support) and technical UI (Gender, Height, Save) stay in English.
2. **Female persona "Tina"** — Tina speaks to users in first person, kind
   tone, never accusatory about food choices.
3. **Profile-gated onboarding.** No AI features (food parsing, coaching,
   consultation) until the user completes the profile form and we can
   compute BMR/TDEE.
4. **Manual-renew payment model.** Premium does NOT auto-charge. User pays
   PromptPay QR or TrueMoney each month. Stripe code is preserved but
   currently dormant.
5. **Premium expiry stacks.** Paying when still premium adds days to the
   current expiry, not from "now" — no day is ever lost. See
   [Payments overview](/documentation/payments/overview/).

## Where to next

- [**Prerequisites**](/documentation/getting-started/prerequisites/) — what
  accounts and tools you'll need.
- [**Local setup**](/documentation/getting-started/local-setup/) — clone,
  install, run backend + LIFF on your machine.
- [**Architecture overview**](/documentation/architecture/overview/) —
  system diagram + data flow.
