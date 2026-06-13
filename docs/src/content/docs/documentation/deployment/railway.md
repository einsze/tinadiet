---
title: Railway (Backend)
description: Service config, volume, env vars, console access.
sidebar:
  order: 2
---

The backend runs on **Railway** in their Singapore region on the Hobby plan
($5/month).

## Service config

- **Project ID**: kept private (see SECRETS file)
- **Service name**: `backend`
- **Source**: GitHub `einsze/tinadiet` repo, builds from `projects/backend/`
- **Region**: Asia-Southeast (Singapore)
- **Plan**: Hobby ($5/month) — sufficient for MVP traffic
- **Build**: nixpacks (auto-detects Node + npm)
- **Start command**: default from `package.json` `start` script (`node dist/index.js`)
- **Port**: 3000 (Railway injects `$PORT`)
- **Private internal name**: `backend.railway.internal`
- **Public URL**: auto-generated `*.up.railway.app` (fallback, kept private)
- **Custom domain**: `api.tinadiet.com` (Cloudflare proxied)

## Volume

- **Name**: `backend-volume`
- **Mount path**: `/data` (not `/app/data` — see gotcha below)
- **Size**: 1 GB
- **Backups**: NOT configured (Bucket A todo — should set up Railway
  volume snapshots before LIVE launch)

**Critical gotcha**: the volume mounts at `/data` ROOT. Production
`DATABASE_URL` is `file:/data/app.db`. better-sqlite3 silently creates
ghost empty files when the path is wrong — if you see "no rows" but
expect data, double-check the path is `/data/app.db` not `./data/app.db`
or `/app/data/app.db`.

See feedback memory `feedback_railway_sqlite_volume_path`.

## Build optimization

`nixpacks.toml` in `backend/` skips the better-sqlite3 source rebuild:

```toml
[phases.install]
cmds = [
  "npm ci"      # NOT npm ci --build-from-source
]
```

Saves ~1 minute per deploy. Prebuilt binary works fine on Node 22 LTS.

## Env vars

Set via Railway dashboard → service `backend` → Variables tab. Some are
required for boot; others are graceful-when-empty.

Required (or boot fails):
- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_LOGIN_CHANNEL_ID`
- `SESSION_JWT_SECRET`

Graceful (empty = feature disabled):
- `OPENAI_API_KEY` — AI features 503 when empty
- `OMISE_*` — payment 503 when `OMISE_SECRET_KEY` empty
- `STRIPE_*` — currently empty intentionally
- `OMISE_WEBHOOK_SECRET` — webhook accept-all when empty (DEV ONLY)
- `JOBS_TRIGGER_SECRET` — `/internal/jobs/*` returns 401 when empty

Has defaults (override if needed):
- `OPENAI_MODEL=gpt-4o-mini`
- `OPENAI_VISION_MODEL=gpt-4o`
- `DAILY_SUMMARY_CRON=0 21 * * *`
- `WEEKLY_SUMMARY_CRON=0 8 * * 1`
- `EXPIRE_PREMIUM_CRON=0 2 * * *`
- `CRON_TZ=Asia/Bangkok`
- `PAYMENT_AMOUNT_THB=150`
- `PAYMENT_GRANT_DAYS=30`

See [Reference — Env Vars](/documentation/reference/env-vars/) for the full
list.

## Auto-redeploy on env change

Railway redeploys the service when any env var is added, changed, or
removed. This means:
- Change a non-critical env var = ~3 min downtime (cold restart) — schedule
  during low traffic
- Push of new code WITH env change = Railway might do 2 deploys in
  succession (one for env, one for code) — be aware

## Console access (for DB queries)

Railway provides a web Console:
- Dashboard → backend service → **Console** tab
- Bash shell inside the running container
- Has access to `/data/app.db`
- **No `sqlite3` CLI** — use `node -e` inline with `better-sqlite3`

Example session:
```bash
node -e 'const db = require("better-sqlite3")("/data/app.db"); console.log(db.prepare("SELECT COUNT(*) AS n FROM users").get());'
# { n: 2 }
```

See [Ops — DB Queries](/documentation/ops/db-queries/) for a full
runbook of snippets.

## Monitoring

- **Logs**: Railway dashboard → service → Deployments → latest deploy →
  View Logs (real-time + searchable history)
- **Metrics**: CPU, memory, network, disk usage in Metrics tab
- **Healthcheck**: Railway pings `/healthz` periodically (built into the
  service)

## TLS

Let's Encrypt auto-managed by Railway via Cloudflare's proxied DNS. No
manual cert renewal needed.

## Deploy history

```
Latest deploys live in Railway dashboard → service → Deployments tab.
Each deploy is keyed to a git SHA (sourced from RAILWAY_GIT_COMMIT_SHA env).
```

The deployed commit is reflected in `/healthz` `commit` field — useful
for verifying which version is running:
```bash
curl https://api.tinadiet.com/healthz | jq -r '.commit'
# 197f3dd
```

## Common operations

### View latest deploy logs
```
Dashboard → backend → Deployments → click latest → View Logs
```

### Tail real-time logs
```
Dashboard → backend → Logs tab (live tail)
```

### Restart service
```
Dashboard → backend → Settings → Restart
```

### Rollback to previous deploy
```
Dashboard → backend → Deployments → click a previous green → Redeploy
```

### SSH into container
Not supported on Hobby plan. Use the Console (web shell) instead.

### Trigger a deploy without code change
Push an empty commit:
```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push
```
Or in Railway dashboard, Redeploy on the latest commit.
