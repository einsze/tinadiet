# Tina Diet — Documentation Site (Plan)

> **Status**: PLAN phase — not yet built. This file documents the structure,
> content outline, and implementation steps. When ready, follow the
> [Implementation checklist](#implementation-checklist) section.
>
> **Audience**: Project owner (`einsze`) + future technical collaborators who
> need to onboard the codebase. **Not** end-users — those are served by LIFF
> in-app SupportPage + FAQ.

---

## 1. Decision summary

| Question | Decision | Why |
|---|---|---|
| **Audience** | Developer + future collaborators | Per session 2026-06-13; product UX docs already covered by LIFF SupportPage |
| **Hosting** | Cloudflare Pages (separate project `tinadiet-docs`) | Decouple from LIFF; static site = cheap + fast; Pages auto-deploy on push |
| **Domain** | `tinadiet.com` apex (was unused) | Brand domain, dev-facing → makes sense to claim apex |
| **Path** | `/documentation/*` for docs, `/` for minimal landing | Both useful; landing page provides apex root context for stumbling visitors |
| **Stack** | Astro + Starlight | Modern, MDX-based, built-in sidebar/search/dark-mode, native CF Pages, fastest DX vs VitePress/Docusaurus |
| **Repo** | Monorepo: new `projects/docs/` directory | Same git history, single PR for backend + LIFF + docs changes when they touch same feature |
| **Language** | English | Dev-facing; Thai content stays in LIFF for end-users |
| **Authentication** | None (public) | No sensitive content — secrets stay in `SECRETS_TINADIET_LOCAL.md` outside repo |

---

## 2. Tech stack

- **Framework**: [Astro](https://astro.build) v5+ with [Starlight](https://starlight.astro.build/) plugin
- **Content**: Markdown / MDX in `src/content/docs/`
- **Styling**: Starlight defaults (sufficient — rose-pink palette can be added via custom CSS to match brand)
- **Search**: [Pagefind](https://pagefind.app) (auto-bundled by Starlight, no API key needed)
- **Code highlight**: Shiki (built-in, supports TypeScript / TSX / SQL / shell)
- **Diagrams** (optional): [Mermaid](https://mermaid.js.org) via `@astrojs/starlight-mermaid` for architecture diagrams
- **Deploy**: Cloudflare Pages, auto-build on push to `main` (branch `main` only)
- **Node**: 22+ (Starlight requires Node 18+; Cloudflare LIFF already at 22 per existing setup)

---

## 3. Architecture

### Current production state (no change)

```
github.com/einsze/tinadiet (PUBLIC repo)
│
├─ projects/backend/   ──→ Railway (Singapore, Hobby) ──→ api.tinadiet.com
├─ projects/liff/      ──→ Cloudflare Worker (tinadiet-liff) ──→ app.tinadiet.com
└─ projects/ops/       ── (no deploy, just markdown runbooks)
```

### After docs site ships

```
github.com/einsze/tinadiet
│
├─ projects/backend/   ──→ Railway ──→ api.tinadiet.com
├─ projects/liff/      ──→ Cloudflare Worker ──→ app.tinadiet.com
├─ projects/docs/      ──→ Cloudflare Pages (tinadiet-docs) ──→ tinadiet.com/*  ← NEW
└─ projects/ops/       ── (some content sourced into docs site)
```

---

## 4. Routing strategy

### tinadiet.com apex

| Path | Content | Astro source |
|---|---|---|
| `/` | Minimal landing page: logo Tina + 1-liner + 2 CTA buttons | `src/pages/index.astro` |
| `/documentation` | Docs landing (Starlight intro) | `src/content/docs/index.md` |
| `/documentation/<section>/<page>` | Individual doc pages | `src/content/docs/<section>/<page>.md` |
| `/*` (anything else) | 404 | Astro default |

**Note on apex landing page content**:
- Tina mascot logo (reuse from LIFF `/tinadiet-mascot.png`)
- Headline: "Tina Diet — Your AI Diet Coach for Thailand"
- Subline: short Thai + English description
- Two CTA buttons:
  1. **"Open in LINE"** → `https://line.me/R/ti/p/@913civqx` (LINE OA add-friend deep link)
  2. **"Documentation"** → `/documentation`
- Footer micro-text: GitHub link + copyright

This is a tiny page (~50 lines Astro), styled with inline Tailwind or vanilla CSS.

### Astro config (sketch)

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://tinadiet.com',
  integrations: [
    starlight({
      title: 'Tina Diet Docs',
      logo: { src: './src/assets/mascot.png' },
      social: {
        github: 'https://github.com/einsze/tinadiet',
      },
      sidebar: [
        { label: 'Introduction', slug: 'introduction' },
        { label: 'Getting Started', autogenerate: { directory: 'getting-started' } },
        { label: 'Architecture', autogenerate: { directory: 'architecture' } },
        { label: 'Backend', autogenerate: { directory: 'backend' } },
        { label: 'LIFF', autogenerate: { directory: 'liff' } },
        { label: 'Payments', autogenerate: { directory: 'payments' } },
        { label: 'Deployment', autogenerate: { directory: 'deployment' } },
        { label: 'Operations', autogenerate: { directory: 'ops' } },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
        { label: 'Decisions (ADR)', autogenerate: { directory: 'decisions' }, collapsed: true },
      ],
      customCss: ['./src/styles/brand.css'],  // optional rose-pink theming
      routeMiddleware: undefined,
    }),
  ],
  // Apex root (/) handled by src/pages/index.astro — Astro auto-serves Astro pages alongside Starlight content
});
```

Starlight by default mounts at `/`. To mount at `/documentation`, we use a top-level Astro page for `/` and let Starlight handle anything under `/documentation`. Two approaches:

**Approach A — Starlight at root, landing page replaces docs index** (NOT what we want):
- Starlight default. tinadiet.com/ = docs landing. No separate apex landing.

**Approach B — Astro pages alongside Starlight at custom prefix** (✅ what we want):
- Use Starlight's `prefix` option (Astro 5 + Starlight 0.30+ feature):
  ```js
  starlight({
    title: 'Tina Diet Docs',
    prefix: '/documentation',
    // ...
  })
  ```
- `src/pages/index.astro` handles `/` (the landing page)
- Starlight serves everything under `/documentation/*`
- ⚠ Verify Starlight `prefix` option is supported at build time; if not, use Astro `base` config or Cloudflare redirect rules.

If `prefix` doesn't work cleanly, fallback: put landing inside Starlight as a custom layout for `index.md`, hide from sidebar. Less clean but works.

---

## 5. Initial content outline (8 pages)

Each page lists target content as bullets. Word count estimate: ~300-800 per page. Total initial corpus: ~4000-6000 words.

### 5.1 `introduction.md`

- Brand: Tina Diet, mascot, target audience (Thai LINE users for nutrition coaching)
- High-level value: AI-powered food logging + macro tracking + Thai-first consultation
- Repo overview: monorepo layout (backend / liff / docs / ops)
- Technology summary table (Express + better-sqlite3 + React + LINE LIFF + OpenAI + Omise)
- Key invariants:
  - Thai-first content (ค่ะ register), English-only navigation chrome
  - Female persona (Tina)
  - Manual-renew payment model (no auto-charge subscription)
  - Profile-gated onboarding (BMR/TDEE math required before AI features)
  - Premium tier (150 THB / 30 days)
- Links: GitHub repo, Live LIFF, LINE OA, contact
- "What this doc covers" mini-TOC

### 5.2 `getting-started/`

**`prerequisites.md`**:
- Node 22+ (LIFF requires; backend tolerates 20 but standardize on 22)
- pnpm or npm
- Git
- VS Code recommended (with extensions: ESLint, Tailwind, MDX)
- Cloud accounts needed for full local-to-prod cycle:
  - GitHub (push access if collaborating)
  - LINE Developers (Messaging + Login channels)
  - Omise (TEST mode for dev, LIVE for prod)
  - OpenAI (project key)
  - Cloudflare (workers + pages)
  - Railway (backend hosting)

**`local-setup.md`**:
- Clone: `git clone https://github.com/einsze/tinadiet.git`
- Install backend: `cd projects/backend && npm install`
- Install LIFF: `cd projects/liff && npm install`
- Copy `.env.example` → `.env` in both
- Required env vars to fill (point to env vars reference page)
- Run backend dev: `npm run dev` (port 3000)
- Run LIFF dev: `npm run dev` (port 5173 via Vite)
- Tunnel needed for LINE webhook: cloudflared tunnel example
- Test webhook: send a message to the bot, watch backend logs

**`first-contribution.md`** (optional, can skip initial):
- Branch naming convention
- Commit message format
- PR review process (solo for now, but documented for collaborators)
- Typecheck + lint before commit

### 5.3 `architecture/`

**`overview.md`**:
- System diagram (Mermaid):
  ```
  User (Thai) ──LINE app──> LINE OA Bot ──webhook──> Railway backend
                                                    │
                                                    ├──→ OpenAI (gpt-4o + gpt-4o-mini)
                                                    ├──→ SQLite (Railway volume)
                                                    └──→ Omise (charges + webhooks)

  User ──Rich Menu──> LIFF (app.tinadiet.com) ──API──> Railway backend ──→ SQLite
  ```
- Data flow narrative: signup → onboarding → food log → AI parse → DB → push summary
- Synchronous vs async boundaries (webhook ACK fast, AI parse async)

**`data-model.md`**:
- Schema overview (tables: users, food_logs, weight_logs, chat_messages, subscriptions, payments)
- Relationships diagram
- Key invariants: denormalized date (TZ-aware), CASCADE deletes, grant stacking
- Link to migration history

**`key-invariants.md`**:
- Lazy stmts pattern in repositories (why module-level prepare crashes)
- Express middleware order (webhook routes BEFORE express.json)
- LIFF public vs auth routes (privacy/terms/documentation are public, others auth)
- Thai timezone handling (`Asia/Bangkok` via Intl en-CA locale)

### 5.4 `backend/`

**`stack.md`**:
- Express 4 + TypeScript ESM + Node 22
- better-sqlite3 (synchronous, fast; no async/await for DB)
- @line/bot-sdk v9
- jsonwebtoken (session)
- node-cron
- openai SDK v6
- zod (validation)

**`repositories.md`**:
- The lazy stmts pattern, why it exists (ESM hoisting + migration order)
- Each repo: type Stmts → `let _stmts: Stmts | null = null` → `stmts()` getter
- Hydrate pattern (deserialize INTEGER → boolean)
- Example: usersRepository walkthrough

**`services.md`** (intro + link per-service deep dive):
- food_parser (text + vision parsing)
- coach (proactive meal suggestion)
- consultation (Q&A with refusal logic)
- omise (HTTP client + webhook handler)
- stripe (dormant, kept for future)

**`routes.md`**:
- /api/v1/* — LIFF-facing, requireAuth
- /webhooks/* — LINE + Omise (and dormant Stripe)
- /internal/jobs/* — admin/cron triggers, x-jobs-secret gate
- /healthz — public health check

**`jobs.md`**:
- node-cron scheduling
- daily_summary (21:00 ICT)
- weekly_summary (Monday 08:00 ICT)
- expire_premium (02:00 ICT)
- (planned) renewal_reminders (10:00 ICT)
- Internal trigger endpoints for testing

### 5.5 `liff/`

**`stack.md`**:
- Vite 5 + React 18 + Tailwind 3 + TypeScript
- @line/liff v2
- react-router-dom v6 (multi-page)
- lucide-react (icons matching Rich Menu design)
- marked (legal doc rendering)
- wrangler 4 (Cloudflare deploy)

**`routing.md`**:
- Public routes (no LIFF auth): `/privacy`, `/terms`
- Authenticated routes (LIFF auth required): all others
- `getPublicLegalDocument()` pattern in App.tsx
- AuthGate flow: idle → init → needs_login → authenticating → ready / error
- Multi-page split (Sprint 5 M2): 5 page + Support + Settings

**`design-system.md`**:
- Rose-pink brand palette (`brand-50` → `brand-900`)
- Typography: Tailwind defaults
- Component conventions: lucide icons, gradient buttons, mobile-first
- AppShell: header + main + bottom nav

**`liff-specific.md`**:
- LIFF SDK init + session JWT exchange
- liff.openWindow caveats (especially for TrueMoney redirect)
- LINE webview quirks (Vite allowed hosts, deep links)

### 5.6 `payments/`

**`overview.md`**:
- Two providers in repo: Omise (PRIMARY, active) + Stripe (DORMANT, code preserved)
- Manual-renew model: 150 THB → 30 days premium, no auto-charge
- Grant stacking: premium_expires_at = max(now, current_expiry) + 30 days
- Why manual renew? PromptPay + TrueMoney inherently one-time (Thai market reality)

**`omise-integration.md`**:
- HTTP client (thin, native fetch, no SDK)
- Charge creation flow (PromptPay QR / TrueMoney redirect)
- Webhook HMAC-SHA256 verify (with link to gotcha)
- Idempotency: payment.status === 'successful' early return
- Polling endpoint for missed webhooks

**`stripe-dormant.md`**:
- Why kept (future-proof: if SaaS subscription model added later, foundation ready)
- Env-empty graceful 503 pattern
- Reactivation steps (when needed)

**`webhook-signature-gotcha.md`** → cross-link from [[feedback-omise-webhook-signature]] memory:
- Initial assumption: Basic Auth (WRONG)
- Actual: HMAC-SHA256 with `Omise-Signature` + `Omise-Signature-Timestamp` headers
- Signed payload format: `${ts}.${rawBody}`
- Secret base64-decode + constant-time compare + express.raw not json
- Lesson learned: check dashboard UI BEFORE coding any webhook integration

**`go-live-checklist.md`**:
- Test → Live key flip (Railway env only, no code change)
- Verification docs required from Thai business client
- TrueMoney provider approval lag (7-14 days extra after Omise KYC)
- LIVE testing protocol (teammate with TrueMoney app, real 150 THB)

### 5.7 `deployment/`

**`overview.md`**:
- Railway backend: Singapore region, Hobby plan, volume at /data
- Cloudflare Workers (LIFF Static Assets, SPA fallback)
- Cloudflare Pages (this docs site)
- DNS: Cloudflare Registrar tinadiet.com
- Auto-deploy on push to main

**`railway-backend.md`**:
- Service config (port, build, start command)
- Volume mount at /data — DATABASE_URL = `file:/data/app.db`
- Env vars list (link to reference page)
- Console access for ops queries (no sqlite3 CLI; use node -e — link to ops/db-queries)
- Deploy log monitoring

**`cloudflare-liff.md`**:
- Workers Static Assets, wrangler.toml config
- `not_found_handling = "single-page-application"` for SPA fallback
- Build env: NODE_VERSION=22, VITE_API_BASE_URL, VITE_LIFF_ID
- Custom domain claim flow (DNS conflict resolution)

**`cloudflare-pages-docs.md`**:
- Pages project setup
- Build cmd: `cd projects/docs && npm run build`
- Output: `dist`
- Custom domain tinadiet.com apex setup

**`env-vars-reference.md`** → may live in reference/ instead, link from here.

### 5.8 `ops/`

**`db-queries.md`** ← import content from `projects/ops/DB_QUERIES.md`:
- Health snapshot, user listings, payment queries, mutations, sanity checks
- Source-of-truth = `projects/ops/DB_QUERIES.md`; docs page imports via build step or manual sync

**`manual-grants.md`**:
- Granting premium manually via Railway Console
- SQL pattern + safety SELECT-before-UPDATE
- Reverting + expiry

**`secrets-rotation.md`**:
- Quarterly rotation cadence
- Per-secret rotation steps (LINE, OpenAI, JWT, JOBS_TRIGGER, Omise)
- Impact assessment (e.g. JWT rotate = all sessions invalid)

**`monitoring.md`**:
- /healthz endpoint
- Railway service metrics
- (planned) Sentry integration (DSN already in SECRETS, code not wired)
- (planned) uptime monitoring

**`troubleshooting.md`**:
- Common issues + diagnostic steps:
  - Webhook delivery failing → Omise dashboard Recent Deliveries
  - Premium not applied → check payments table + Omise charge
  - LIFF auth loop → LINE Login channel scope
  - LIFF caching after deploy → Cloudflare purge, user webview close-reopen

### 5.9 `reference/` (auto-generated where possible)

**`env-vars.md`** — all env vars across backend + liff + docs, with description + required/optional + example

**`api-endpoints.md`** — all `/api/v1/*` endpoints with method + auth + body + response shape (manually maintained; long-term: auto-gen from Zod schemas)

**`webhook-endpoints.md`** — `/webhooks/*` with security model + payload shapes

**`migrations.md`** — chronological migration list (0001 users → 0007 omise_payments)

**`schema.md`** — database schema reference, per-table column list with types

### 5.10 `decisions/` (ADR — Architecture Decision Records)

Numbered ADRs, dated, format: Status / Context / Decision / Consequences.

- `adr-001-monorepo.md` — Why monorepo vs split repos
- `adr-002-sqlite-vs-postgres.md` — Why better-sqlite3 + Railway volume
- `adr-003-omise-not-stripe.md` — Payment pivot rationale
- `adr-004-manual-renew-model.md` — Why no auto-charge
- `adr-005-hmac-not-basic-auth.md` — Mid-sprint refactor lesson
- `adr-006-thai-first-i18n.md` — Thai content, English chrome
- `adr-007-cloudflare-workers-vs-pages.md` — LIFF on Workers, docs on Pages

ADRs are short (200-400 words each). Total: 7 entries × 300 = ~2100 words.

---

## 6. Future content ideas (post-initial)

- Per-service deep dives with code excerpts: food_parser prompt engineering, coach contextual rules, consultation refusal logic
- Tutorial: "Add a new LIFF page" walkthrough
- Tutorial: "Add a new database migration" walkthrough
- Tutorial: "Add a new env var" (workflow across .env.example → env.ts → Railway dashboard)
- Frontend design system page with live component preview (use Starlight's MDX support to embed React components)
- Postmortem-style writeups for any incidents
- Performance notes (better-sqlite3 perf characteristics, OpenAI cost tracking)
- Migration guide for the SQLite → Postgres jump if scale demands

---

## 7. Implementation checklist

When ready to build:

### 7.1 Repo setup (~30 min)

- [ ] `cd projects/ && mkdir docs && cd docs`
- [ ] `npm create astro@latest .` → choose "Empty" template
- [ ] `npx astro add starlight`
- [ ] `npx astro add mdx` (for MDX support if needed)
- [ ] Optionally: `npm i @astrojs/starlight-mermaid` for diagrams
- [ ] Create `src/styles/brand.css` with rose-pink overrides (copy palette from liff/tailwind.config.js)
- [ ] Create `src/assets/mascot.png` (copy from liff/public/tinadiet-mascot.png)
- [ ] Update `astro.config.mjs` per [Section 4 Astro config sketch](#astro-config-sketch)
- [ ] Test locally: `npm run dev` → confirm `/` and `/documentation` both render

### 7.2 Landing page (~30 min)

- [ ] Create `src/pages/index.astro`
- [ ] Implement minimal layout: logo + headline + CTAs
- [ ] Style with vanilla CSS or `@tailwindcss/vite` integration

### 7.3 Initial content (estimated ~4 hours)

Order by dependency:
- [ ] introduction.md
- [ ] getting-started/prerequisites.md
- [ ] getting-started/local-setup.md
- [ ] architecture/overview.md (with Mermaid diagram)
- [ ] architecture/data-model.md
- [ ] backend/stack.md
- [ ] backend/repositories.md (the lazy-stmts pattern is crucial)
- [ ] liff/stack.md
- [ ] payments/overview.md
- [ ] payments/omise-integration.md
- [ ] deployment/overview.md
- [ ] ops/db-queries.md (sync from projects/ops/DB_QUERIES.md)
- [ ] reference/env-vars.md

Skip for initial ship, add iteratively: ADRs, per-service deep dives, troubleshooting expansion.

### 7.4 Deployment (~30 min)

- [ ] Push to main, verify Cloudflare auto-build picks up `projects/docs/`
- [ ] Cloudflare Pages project setup:
  - Name: `tinadiet-docs`
  - Build cmd: `cd projects/docs && npm install && npm run build`
  - Output: `projects/docs/dist`
  - Env vars: `NODE_VERSION=22`
- [ ] First deploy → verify `tinadiet-docs.pages.dev` works
- [ ] DNS: Cloudflare → tinadiet.com → custom domain on Pages project
- [ ] Verify `https://tinadiet.com/` and `https://tinadiet.com/documentation/` both live
- [ ] Add CNAME for `www.tinadiet.com` → 301 redirect to apex (optional)

### 7.5 Polish (~30 min)

- [ ] Brand favicon + og:image
- [ ] Cloudflare cache rules (24h for HTML, 1y for assets)
- [ ] Test mobile responsiveness
- [ ] Sitemap.xml auto-gen
- [ ] robots.txt allow all

### 7.6 Post-launch

- [ ] Add link "📖 Docs" to GitHub repo README
- [ ] Mention in LIFF SupportPage if relevant
- [ ] Set up content review cadence (monthly check for drift between docs and code)

---

## 8. Maintenance conventions

When ready to maintain:

- **Single source of truth**: code (backend / liff) is canon; docs reflect code. When code changes, update docs in same PR.
- **Frontmatter discipline**: every `.md` file has `title`, `description`, `sidebar.order` (where manual ordering needed)
- **Sync `projects/ops/DB_QUERIES.md` → docs ops page**: manual copy for now; can automate with a build script later
- **ADR immutability**: once an ADR is accepted, never edit content — write a new ADR superseding the old, link bidirectionally
- **Internal links**: use Starlight's `[text](/section/page)` syntax; build will warn on broken links
- **Code examples**: prefer real snippets from the codebase over hypothetical examples; comment with file path (e.g. `// backend/src/services/omise.ts`) so reader can locate
- **External links**: prefer GitHub permalinks (with commit SHA) for code references to avoid rot

---

## 9. Open questions / decisions to revisit

- **Should ADRs be tracked separately (e.g. `projects/docs/adr/` markdown standalone) and *also* rendered in docs site?** Pro: single source of truth that's editable outside web context. Con: duplication.
- **Auto-sync DB_QUERIES.md → docs page** via build script — worth doing day-1 or post-MVP?
- **`www.tinadiet.com` handling** — redirect to apex, or skip subdomain?
- **Search privacy** — Pagefind builds full-text index; for a public docs site this is fine. No PII in docs.
- **Versioned docs** when API changes — not relevant pre-v1, but consider Starlight versioning when stable.

---

## 10. References

- [Astro Starlight docs](https://starlight.astro.build/)
- [Cloudflare Pages docs](https://developers.cloudflare.com/pages/)
- [MDX](https://mdxjs.com/)
- Sister repos:
  - `projects/backend/` — Express API
  - `projects/liff/` — React LIFF SPA
  - `projects/ops/` — Operational runbooks (some content sourced here)
