---
title: Overview
description: How Tina Diet is deployed across Railway and Cloudflare.
sidebar:
  order: 1
---

Production runs across three services + one registrar:

| Service | What | Trigger |
|---|---|---|
| Railway | Backend (Express + SQLite volume) | `git push main` → auto-deploy |
| Cloudflare Workers | LIFF (static SPA) | `git push main` → auto-build |
| Cloudflare Pages | This docs site | `git push main` → auto-build |
| Cloudflare Registrar | Domain `tinadiet.com` | manual once |

## Production URLs

| URL | Backed by |
|---|---|
| `https://api.tinadiet.com` | Railway service `backend` (Singapore) |
| `https://app.tinadiet.com` | Cloudflare Worker `tinadiet-liff` |
| `https://tinadiet.com` | Cloudflare Pages `tinadiet-docs` |
| `https://tinadiet.com/documentation/*` | Same Pages project (this site) |

DNS is managed in Cloudflare (registrar + DNS), records all proxied
through Cloudflare's network (orange cloud).

## Deploy flow

```
git push origin main
  │
  ├──→ GitHub
  │     │
  │     ├──→ Railway webhook → detects changes in projects/backend/ →
  │     │     - Build with nixpacks (Node 22, npm install, tsc)
  │     │     - Restart container with new image
  │     │     - Volume /data persists across deploys
  │     │
  │     ├──→ Cloudflare Workers Builds → detects changes in projects/liff/ →
  │     │     - npm install + npm run build (Vite → dist/)
  │     │     - wrangler deploy → publishes to tinadiet-liff worker
  │     │
  │     └──→ Cloudflare Pages → detects changes in projects/docs/ →
  │           - npm install + npm run build (Astro → dist/)
  │           - Publishes to tinadiet-docs project
  │
  ▼
All three services live in ~3-5 minutes
```

## Verifying a deploy

After push, wait ~3-5 min then check each:

**Backend**:
```bash
curl https://api.tinadiet.com/healthz
# Look for the `commit` field matching your latest commit SHA
```

**LIFF**: Open `https://app.tinadiet.com` in browser. Check Network tab
for the latest JS bundle hash. Hard-refresh in mobile LINE webview by
closing + reopening from Rich Menu.

**Docs**: Open `https://tinadiet.com/documentation/`. Pages keeps build
log per deploy in Cloudflare dashboard.

## Rollback

Each service has its own rollback mechanism:

| Service | Rollback path |
|---|---|
| Railway | Dashboard → backend service → Deployments tab → click a previous green deploy → **Redeploy** |
| Cloudflare Workers | Dashboard → Workers → tinadiet-liff → Deployments → previous version → **Rollback** |
| Cloudflare Pages | Dashboard → Pages → tinadiet-docs → Deployments → previous → **Rollback to this deployment** |

For DB rollback (rare — migrations are forward-only), the only safe path
is a manual SQL fix via Railway Console. There's no migration rollback
script.

## Region choices

- **Railway**: Singapore — closest to Thailand for lowest latency
- **Cloudflare**: Global edge network, traffic auto-routed to nearest PoP
  (Thailand traffic typically Bangkok or Singapore PoP)
- **DNS TTL**: low (60-300s) to allow fast region/IP changes

## Cost summary

| Service | Plan | Cost |
|---|---|---|
| Railway | Hobby | $5/month |
| Cloudflare Workers (LIFF) | Free | $0 |
| Cloudflare Pages (docs) | Free | $0 |
| Cloudflare Registrar | At-cost | ~$10/year for .com |
| OpenAI | Pay-as-you-go | ~$5-20/month at MVP scale |
| Omise fees | Per-txn | ~3.65% |
| Sentry | Developer (free) | $0 |

Total fixed: ~$5/month + $10/year. Variable: AI usage + Omise fees per
revenue.

## See also

- [Railway](/documentation/deployment/railway/) — backend specifics
- [Cloudflare LIFF](/documentation/deployment/cloudflare-liff/) — Workers config
- [Cloudflare Pages](/documentation/deployment/cloudflare-pages-docs/) — this site
