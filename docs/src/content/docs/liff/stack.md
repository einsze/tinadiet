---
title: Stack
description: LIFF tech stack, build, and deploy.
sidebar:
  order: 1
---

The LIFF (LINE Front-end Framework) app is a React SPA delivered as static
assets by a Cloudflare Worker.

## Stack at a glance

| Layer | Choice | Pinned |
|---|---|---|
| Bundler | Vite 5 | `^5.4.x` |
| Framework | React 18 | `^18.3.x` |
| Routing | react-router-dom 6 | `^6.30.x` |
| Styling | Tailwind CSS 3 | `^3.4.x` |
| LINE SDK | `@line/liff` v2 | `^2.x` |
| Icons | `lucide-react` | `^0.x` |
| Markdown | `marked` (for legal docs) | `^x` |
| Deploy | Wrangler 4 | `^4.x` |
| Hosting | Cloudflare Workers Static Assets | — |
| Language | TypeScript strict | `~5.x` |

## Project layout

```
liff/src/
├── App.tsx                 Top-level router + AuthGate
├── main.tsx                React entry
├── index.css               Tailwind + custom keyframes
├── api/                    typed HTTP client per resource
│   ├── auth.ts
│   ├── users.ts
│   ├── foodLogs.ts
│   ├── weightLogs.ts
│   ├── chat.ts
│   ├── billing.ts
│   └── account.ts
├── assets/                 inline imports (mascot, etc.)
├── components/
│   ├── AppShell.tsx        header + main + bottom nav
│   ├── AuthLoadingScreen.tsx
│   ├── OnboardingSplash.tsx
│   ├── ProfileForm.tsx
│   ├── Dashboard sections (PremiumSection, ChatSection, etc.)
│   ├── KcalRing.tsx
│   ├── WeightChart.tsx
│   └── LegalPage.tsx
├── hooks/
├── i18n/
├── lib/
│   ├── api.ts              fetch wrapper + session token
│   ├── env.ts              VITE_* env vars
│   └── premium.ts          isPremium mirror
├── pages/                  route components
│   ├── DashboardPage.tsx
│   ├── ProfilePage.tsx
│   ├── PremiumPage.tsx
│   ├── ChatPage.tsx
│   ├── SettingsPage.tsx
│   ├── SupportPage.tsx
│   └── NotFoundPage.tsx
├── state/
│   └── session.ts          User + streak + premium
├── styles/                 (rarely used; Tailwind is primary)
└── types/                  shared types mirroring backend
    ├── user.ts
    ├── foodLog.ts
    ├── weightLog.ts
    ├── chatMessage.ts
    └── billing.ts
```

## Deploy pipeline

1. `git push origin main` → Cloudflare Workers Builds detects change in
   `projects/liff/`
2. Build command: `cd liff && npm install && npm run build`
3. Output: `liff/dist/`
4. Deploy command: `cd liff && npx wrangler deploy`
5. Worker `tinadiet-liff` serves from `dist/` with SPA fallback

## wrangler.toml essentials

```toml
name = "tinadiet-liff"
compatibility_date = "2024-XX-XX"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

The `not_found_handling = "single-page-application"` is critical — it
makes ANY path return `index.html` so react-router can handle client-side
routing (essential for `/privacy`, `/premium`, `/profile`, etc.).

Do NOT use Cloudflare Pages-style `_redirects` file — Workers rejects it
with error 100324. See feedback memory
`feedback-cloudflare-workers-vs-pages-redirects`.

## Environment variables

Vite reads `VITE_*` prefixed env vars at BUILD time, embedding them in
the bundle:

| Var | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend URL — `https://api.tinadiet.com` in prod |
| `VITE_LIFF_ID` | LIFF channel ID from LINE Developers Console |

Plus `NODE_VERSION=22` set in Cloudflare Workers Builds dashboard (required
since Sprint 3 wrangler 4 upgrade).

## Why no SSR / Next.js / Remix?

- LIFF runs inside LINE's webview — there's no SEO benefit to SSR (LINE
  doesn't crawl)
- LIFF SDK init is client-side anyway
- Cloudflare Workers Static Assets has very low cold start (no Node
  runtime needed)
- Vite + React = simple, fast dev iteration, mature ecosystem

If SEO of marketing pages becomes important, that's a separate site (this
docs site already separates) — not a reason to add SSR to LIFF.
