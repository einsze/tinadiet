---
title: Cloudflare (LIFF)
description: Workers Static Assets config, wrangler, custom domain.
sidebar:
  order: 3
---

The LIFF SPA is deployed to **Cloudflare Workers** using Workers Static
Assets — a successor to Cloudflare Pages for static sites that need
Workers' edge compute.

## Worker config

- **Worker name**: `tinadiet-liff`
- **Workers subdomain**: `ein-carvi.workers.dev` (default)
- **Custom domain**: `app.tinadiet.com`
- **Source**: GitHub `einsze/tinadiet`, builds from `projects/liff/`
- **Cloudflare account**: `ein.carvi@gmail.com`

## wrangler.toml

```toml
name = "tinadiet-liff"
compatibility_date = "2024-XX-XX"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

**Critical**: `not_found_handling = "single-page-application"` makes ANY
unknown path return `index.html`. This is the equivalent of an Nginx
`try_files` fallback for SPAs. Without it, deep links like `/premium` or
`/privacy` would 404.

**Do NOT add `liff/public/_redirects`** (Pages-style SPA fallback file).
Workers Static Assets rejects it with error 100324 "Infinite loop". Use
`not_found_handling` in wrangler.toml only.

See feedback memory `feedback-cloudflare-workers-vs-pages-redirects`.

## Build pipeline (Cloudflare Workers Builds)

Configured in Cloudflare dashboard → Workers → tinadiet-liff → Settings:

- **Build command**: `cd liff && npm install && npm run build`
- **Deploy command**: `cd liff && npx wrangler deploy`
- **Root directory**: repository root (`/`)
- **Branch**: `main`

Env vars (build-time Vite vars):
- `VITE_LIFF_ID`
- `VITE_API_BASE_URL=https://api.tinadiet.com`
- `NODE_VERSION=22` (required since wrangler 4 — see feedback memory
  `feedback-wrangler-v4-needs-node-22`)

## Custom domain

`app.tinadiet.com` is claimed as a Custom Domain on the worker:
- Cloudflare dashboard → Workers → tinadiet-liff → Settings → Triggers
- Add custom domain `app.tinadiet.com`
- DNS record auto-created
- SSL auto-provisioned (Let's Encrypt via Cloudflare)

**Gotcha**: If you ever delete + recreate the custom domain claim,
Cloudflare may fail to re-claim it because a stale DNS record `app` still
exists. Delete the DNS record manually first, then re-add the custom
domain.

## Deploy verification

After push to main:
1. Cloudflare Workers Builds detects change in `projects/liff/`
2. Build runs (~30-60 seconds)
3. Worker re-deployed with new bundle
4. Cloudflare edge cache invalidated for the worker

To verify in browser:
- `https://app.tinadiet.com` should serve fresh `index.html` (check Network
  tab — `cf-cache-status: MISS` initially, then `HIT` once cached)
- Hard refresh in mobile LINE webview: close chat, reopen, tap Rich Menu

## Cold start

Workers Static Assets has near-zero cold start (just serving files from
Cloudflare's edge cache). Even global users experience <100ms initial
load.

## Cache strategy

Cloudflare default for static assets:
- HTML: `cache-control: public, max-age=0, must-revalidate` (always
  re-validate; allows fast deploys to propagate)
- JS/CSS hashed bundles: `cache-control: public, max-age=31536000, immutable`
  (1 year, since Vite hashes bundle names)
- Images: standard cache headers from Vite

For more aggressive control, configure Cloudflare Cache Rules in the
dashboard. Not currently customized.

## Logs

Workers Static Assets doesn't have per-request logs by default (it's pure
asset serving). For request logs, enable Cloudflare Workers Logs in the
dashboard. Useful for debugging routing or asset 404s.

## Local dev vs prod

Local dev (`npm run dev` in liff/) uses Vite directly — no Wrangler
involved. Vite's HMR + dev tooling > Wrangler's local mode for SPA dev.

For testing the production build locally:
```bash
cd projects/liff
npm run build
npx wrangler dev
# Now hits Workers runtime on localhost
```

Useful if you suspect a Wrangler-specific issue (caching, routing) vs a
Vite issue.

## Rollback

Cloudflare dashboard → Workers → tinadiet-liff → Deployments → previous
version → **Rollback**. Instant — no rebuild required.

## Why Workers Static Assets and not Pages?

Both work for SPAs. We chose Workers Static Assets because:
- Newer, actively developed by Cloudflare
- Cleaner config (single `wrangler.toml`)
- Native `not_found_handling` SPA fallback (no `_redirects` quirks)
- Can add edge compute later (e.g. inject session token, A/B test) without
  switching platform

Cloudflare Pages still works for marketing sites (this docs site uses
Pages). The split is intentional: docs needs separate domain + simpler
auto-deploy, LIFF needs flexibility for future edge logic.
