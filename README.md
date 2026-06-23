# Tina Diet — AI Nutrition Coach for Thailand

Thai-first AI nutrition coach delivered through LINE LIFF + Messaging API.
End-users log food via chat or photo, track macros against personalized
goals, and consult with Tina (premium).

> 📖 **Full developer documentation**: [tinadiet.com/documentation](https://tinadiet.com/docsfordevtina/)

## Status — production

| Service | URL | Stack |
|---|---|---|
| Backend API | [api.tinadiet.com](https://api.tinadiet.com/healthz) | Railway · Express · better-sqlite3 |
| LIFF app | [app.tinadiet.com](https://app.tinadiet.com) | Cloudflare Workers · Vite · React · Tailwind |
| **Admin dashboard** | **[admin.tinadiet.com](https://admin.tinadiet.com)** | Cloudflare Workers · Vite · React · Tailwind |
| Landing + docs | [tinadiet.com](https://tinadiet.com) | Cloudflare Pages · Astro · Starlight |
| LINE OA | `@913civqx` (TinaDiet) | LINE Messaging API |

**Sprints closed**: 1, 2, 3, 4 (M1-M3), 5 (M1-M3), 6 (M1-M4).

**Payment model (current)**: manual PromptPay top-up → credit balance →
redeem premium bundles. Operators review uploaded slips via the admin
dashboard. Omise auto-payment is dormant (UI shown as "Coming Soon")
pending Thai business verification — code will be refactored post-KYC to
feed the credit ledger too (architectural unification).

**Open**: rotate seed superadmin passwords pre-launch, configure
PromptPay receiver ID in admin settings, test QR scan with 3 major Thai
banks (Kasikorn / SCB / Krungthai), Dependabot CVE triage (21
vulnerabilities), production hardening (Sentry, rate limiting), Omise
LIVE flip when KYC done, lawyer review of legal templates.

## Repository layout

```
projects/
├── backend/   Express + TypeScript ESM + better-sqlite3 + LINE SDK + OpenAI + Omise + bcryptjs
│             Serves LINE webhook (/webhook/line), Omise webhook (/webhooks/omise),
│             LIFF-facing API (/api/v1/*), admin API (/api/v1/admin/*), and
│             internal job triggers. Deployed to Railway (Singapore, Hobby plan).
│
├── liff/      Vite + React 18 + Tailwind 3 + react-router-dom v6 (rose-pink brand)
│             Multi-page LIFF SPA (Home / Ask Tina / Premium / Profile / Support).
│             Premium page is a marketplace: wallet balance + top-up CTA + bundle
│             redemption. Deployed to Cloudflare Workers Static Assets.
│
├── admin/     Vite + React 18 + Tailwind 3 + react-router-dom v6 (blue brand)
│             Operator / superadmin dashboard at admin.tinadiet.com. Pages:
│             payment review (pending + history + detail), user management
│             (credit adjust + abuse flags + block), settings (PromptPay ID +
│             pricing + threshold), operators CRUD, account (password change).
│             Email + bcrypt password auth → 8h admin JWT. Deployed to Cloudflare
│             Workers Static Assets (separate project from LIFF).
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

- **🏗 Architecture overview**: [tinadiet.com/docsfordevtina/architecture/overview](https://tinadiet.com/docsfordevtina/architecture/overview/)
- **💻 Local setup**: [tinadiet.com/docsfordevtina/getting-started/local-setup](https://tinadiet.com/docsfordevtina/getting-started/local-setup/)
- **💰 Payments (Omise)**: [tinadiet.com/docsfordevtina/payments/overview](https://tinadiet.com/docsfordevtina/payments/overview/)
- **🚀 Deployment**: [tinadiet.com/docsfordevtina/deployment/overview](https://tinadiet.com/docsfordevtina/deployment/overview/)
- **🔧 DB queries / ops**: [tinadiet.com/docsfordevtina/ops/db-queries](https://tinadiet.com/docsfordevtina/ops/db-queries/)

## Setup (for collaborators)

Prereqs: Node 22+, Git, accounts at GitHub + LINE Developers + Omise +
OpenAI + Cloudflare + Railway. See [Prerequisites](https://tinadiet.com/docsfordevtina/getting-started/prerequisites/).

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
see the [Local Setup](https://tinadiet.com/docsfordevtina/getting-started/local-setup/)
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
