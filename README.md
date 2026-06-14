# Tina Diet — AI Nutrition Coach for Thailand

Thai-first AI nutrition coach delivered through LINE LIFF + Messaging API.
End-users log food via chat or photo, track macros against personalized
goals, and consult with Tina (premium).

> 📖 **Full developer documentation**: [tinadiet.com/documentation](https://tinadiet.com/documentation/)

## Status — production

| Service | URL | Stack |
|---|---|---|
| Backend API | [api.tinadiet.com](https://api.tinadiet.com/healthz) | Railway · Express · better-sqlite3 |
| LIFF app | [app.tinadiet.com](https://app.tinadiet.com) | Cloudflare Workers · Vite · React · Tailwind |
| Landing + docs | [tinadiet.com](https://tinadiet.com) | Cloudflare Pages · Astro · Starlight |
| LINE OA | `@913civqx` (TinaDiet) | LINE Messaging API |

**Sprints closed**: 1, 2, 3, 4 (M1-M3), 5 (M1-M3), 6 (M1-M2).
**Payment**: Omise PromptPay + TrueMoney working e2e in TEST mode. LIVE
mode pending client Thai business verification docs.
**Open**: Sprint 6 M3 (renewal reminders cron), production hardening
(Sentry, rate limiting), Omise LIVE flip, lawyer review of legal templates.

## Repository layout

```
projects/
├── backend/   Express + TypeScript ESM + better-sqlite3 + LINE SDK + OpenAI + Omise
│             Serves LINE webhook (/webhook/line), Omise webhook (/webhooks/omise),
│             LIFF-facing API (/api/v1/*), and internal job triggers.
│             Deployed to Railway (Singapore, Hobby plan).
│
├── liff/      Vite + React 18 + Tailwind 3 + react-router-dom v6
│             Multi-page LIFF SPA (Home / Ask Tina / Premium / Profile / Support).
│             Deployed to Cloudflare Workers Static Assets.
│
├── docs/      Astro 5 + Starlight 0.30 developer documentation site
│             Source of truth for architecture, API reference, deployment + ops
│             runbooks. Deployed to Cloudflare Pages.
│
├── ops/       Operational runbooks (markdown only, no deploy)
│             DB_QUERIES.md — SQLite query snippets for Railway Console
│             RICH_MENU_SETUP.md — LINE Rich Menu config guide
│
└── .github/   CI workflows (currently empty; CodeQL runs via GitHub Default Setup, no file needed)
```

Each `projects/<name>/` is independently buildable and deployable.
Separate `package.json`, separate dependency trees, separate auto-deploy
on push to `main`.

## Quick links

- **🏗 Architecture overview**: [tinadiet.com/documentation/architecture/overview](https://tinadiet.com/documentation/architecture/overview/)
- **💻 Local setup**: [tinadiet.com/documentation/getting-started/local-setup](https://tinadiet.com/documentation/getting-started/local-setup/)
- **💰 Payments (Omise)**: [tinadiet.com/documentation/payments/overview](https://tinadiet.com/documentation/payments/overview/)
- **🚀 Deployment**: [tinadiet.com/documentation/deployment/overview](https://tinadiet.com/documentation/deployment/overview/)
- **🔧 DB queries / ops**: [tinadiet.com/documentation/ops/db-queries](https://tinadiet.com/documentation/ops/db-queries/)

## Setup (for collaborators)

Prereqs: Node 22+, Git, accounts at GitHub + LINE Developers + Omise +
OpenAI + Cloudflare + Railway. See [Prerequisites](https://tinadiet.com/documentation/getting-started/prerequisites/).

```bash
git clone https://github.com/einsze/tinadiet.git
cd tinadiet/projects

# Backend
cd backend
npm install
cp .env.example .env       # fill in LINE/OpenAI/JWT secrets
npm run dev                # http://localhost:3000

# LIFF (separate terminal)
cd ../liff
npm install
cp .env.example .env       # fill VITE_API_BASE_URL + VITE_LIFF_ID
npm run dev                # http://localhost:5173

# Docs site (optional, for previewing docs changes)
cd ../docs
npm install
npm run dev                # http://localhost:4321
```

For full local setup including cloudflared tunnel for LINE webhook,
see the [Local Setup](https://tinadiet.com/documentation/getting-started/local-setup/)
docs page.

## Stack reference

- **Runtime**: Node.js 22 LTS (see `.nvmrc`), npm 10+
- **Language**: TypeScript 5.6 strict, ESM modules
- **DB**: SQLite via `better-sqlite3` on Railway volume `/data/app.db`
- **Auth**: LINE Login → backend session JWT (HS256)
- **AI**: OpenAI `gpt-4o-mini` (text), `gpt-4o` (vision)
- **Payments**: Omise REST API (no SDK; native fetch wrapper)
- **Cron**: `node-cron` for daily summary, weekly summary, expire premium
- **Branch protection**: enabled on `main`, owner bypasses for solo dev

## Security & contribution

Repo is **public**. Security baseline enabled:
- 🔒 Secret scanning + Push protection (blocks accidental secret commits)
- 🔍 CodeQL analysis (default setup)
- 📦 Dependabot alerts + security updates
- 🛡 Copilot Autofix for CodeQL findings

**Never commit `.env` files or hardcoded secrets** — Push protection will
reject them. All real values live in Railway/Cloudflare env vars and a
local `SECRETS_TINADIET_LOCAL.md` outside any git repo.

For PRs from collaborators: open against `main` → owner review required
→ CodeQL + build checks must pass → merge → auto-deploy.

## License

Proprietary — client deliverable.
