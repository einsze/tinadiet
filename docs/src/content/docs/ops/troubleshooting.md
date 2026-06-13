---
title: Troubleshooting
description: Common issues and diagnostic steps.
sidebar:
  order: 3
---

Quick reference for common production issues.

## Bot not responding

### Symptoms
User sends a message in LINE, no reply.

### Diagnose
1. **Check LINE webhook delivery**:
   - LINE Developers Console → Messaging API channel → Webhook
   - "Last delivery" should show recent attempts with HTTP status
   - If 200 but no reply → backend bug (check logs)
   - If non-200 → backend not reachable or returning error

2. **Check backend `/healthz`**:
   ```bash
   curl https://api.tinadiet.com/healthz
   ```
   Should return `{"status":"ok",...}`. If timeout or 500 → backend down.

3. **Check Railway logs**:
   - Railway dashboard → backend → Logs tab
   - Filter for `webhook.line` or `level":"error"`
   - Look for stack traces around the time of the message

### Common causes
- LINE_CHANNEL_SECRET / ACCESS_TOKEN rotated in console but Railway env
  not updated → signature verification fails → 401
- OpenAI API key invalid (key revoked, budget hit, etc.) → food parsing
  throws → handler crashes → no reply
- DB locked (rare with better-sqlite3, but possible if a previous write
  hung) → restart backend to release

### Fix
- Rotate offending secret, update Railway env, redeploy
- If DB issue: restart backend service via Railway dashboard

## Payment doesn't apply

### Symptoms
User completed payment in PromptPay/TrueMoney but premium not active in
LIFF.

### Diagnose
1. **Check `payments` table for the charge**:
   ```bash
   node -e 'const db=require("better-sqlite3")("/data/app.db");const rows=db.prepare("SELECT * FROM payments WHERE user_id = <USER_ID> ORDER BY id DESC LIMIT 5").all();console.table(rows);'
   ```
   - Status `pending` → webhook didn't arrive or failed
   - Status `successful` but no premium → bug in grant application
   - No row → charge never created

2. **Check Omise dashboard Recent Deliveries**:
   - `dashboard.omise.co/test/webhooks` (or `/webhooks` for LIVE)
   - Look for the most recent delivery, check status
   - Status 200 → backend received OK; bug somewhere downstream
   - Status 400 BAD_SIGNATURE → `OMISE_WEBHOOK_SECRET` mismatch
   - Status 4xx/5xx other → backend logged the error

3. **Check Railway logs for `webhook.omise`**:
   - `webhook.omise.handled` shows event processed
   - `webhook.omise.handle_failed` shows handler error
   - `webhook.omise.bad_signature` shows sig mismatch

### Common causes
- `OMISE_WEBHOOK_SECRET` was rolled in dashboard but Railway not updated
- Webhook URL changed (now wrong) — verify
  `https://api.tinadiet.com/webhooks/omise` is the registered URL
- `tinadiet_user_id` metadata missing from charge → backend can't find user
- charge `metadata.tinadiet_user_id` doesn't match an existing user
  (created in TEST mode with placeholder, etc.)

### Fix
- Verify `OMISE_WEBHOOK_SECRET` matches dashboard (re-roll if uncertain)
- Manually sync via API: `curl -X GET -H "Authorization: Bearer <JWT>"
  https://api.tinadiet.com/api/v1/billing/omise/charge/<charge_id>` —
  forces sync and applies grant if eligible
- Manual grant via Railway Console (last resort) — see
  [Manual grants](/documentation/ops/manual-grants/)

## LIFF blank/stuck screen

### Symptoms
User opens LIFF, sees mascot loading forever, or blank white screen.

### Diagnose
1. **In LINE webview, open dev tools**:
   - LINE Android: tap `︙` (top right) → "Webview tools" → Inspect
   - LINE iOS: connect to Safari debugger via USB cable
   - Check Console for errors

2. **Common error patterns**:
   - `LiffInitError` → LIFF SDK init failed → likely wrong `VITE_LIFF_ID`
     in Cloudflare env, or LIFF channel "Status" is "Developing" (must be
     Public for non-admin users)
   - `Failed to fetch` → backend CORS or network issue
   - `401 Unauthorized` → session JWT exchange failed; backend may not
     have valid `LINE_LOGIN_CHANNEL_ID`

3. **Check Cloudflare deploy status**:
   - Dashboard → Workers → tinadiet-liff → Deployments
   - Most recent deploy succeeded?

### Common causes
- LIFF channel set to "Developing" instead of "Public" (only admin users
  can use Developing-status LIFF)
- `VITE_API_BASE_URL` build env wrong → LIFF can't reach backend
- Backend session JWT secret rotated but old JWTs cached in LIFF SDK →
  exchange fails until next session

### Fix
- Set LIFF Status to Public in LINE Developers Console
- Verify Cloudflare env vars on Workers Build
- Rotate `SESSION_JWT_SECRET` and push to Railway → all sessions invalidate,
  next LIFF init re-exchanges

## Premium expired but still showing premium UI

### Symptoms
User's premium expired (date passed) but LIFF still shows Premium badge.

### Diagnose
1. **Check users.plan and premium_expires_at**:
   ```bash
   node -e 'const db=require("better-sqlite3")("/data/app.db");const row=db.prepare("SELECT id, plan, premium_expires_at FROM users WHERE id = ?").get(<USER_ID>);console.log(row);'
   ```

2. **Verify `expire_premium` cron is running**:
   - Railway logs → search `jobs.expire_premium.tick`
   - Should fire daily at 02:00 ICT
   - If never fired → cron not scheduled (env `CRON_ENABLED=false`?)

### Fix
- Run `expire_premium` manually:
  ```bash
  curl -X POST -H "x-jobs-secret: $JOBS_TRIGGER_SECRET" \
    https://api.tinadiet.com/internal/jobs/expire-premium
  ```
  Returns count of users reverted to free.
- If cron disabled: set `CRON_ENABLED=true` in Railway env

## OpenAI errors

### Symptoms
Bot replies with "ขออภัยค่ะ Tina มีปัญหาเล็กน้อย" or similar fallback.

### Diagnose
1. **Check Railway logs for `food_parser` or `coach` errors**
2. **Check OpenAI dashboard usage**:
   - platform.openai.com → Usage tab
   - Hit monthly budget cap?
   - API key revoked?

### Common causes
- Budget cap hit (project key has $35/month limit)
- API key rotated but Railway env not updated
- OpenAI outage (rare but does happen — status.openai.com)
- gpt-4o-mini deprecated/renamed — model env points to wrong name

### Fix
- Increase budget cap in OpenAI dashboard, or rotate key, or wait for
  upstream recovery

## Cloudflare DNS issues

### Symptoms
`tinadiet.com` or `api.tinadiet.com` not resolving, or wrong target.

### Diagnose
```bash
dig tinadiet.com
dig api.tinadiet.com
dig app.tinadiet.com
```

### Common causes
- DNS record deleted accidentally
- TTL changed but cache hasn't refreshed
- Cloudflare proxy disabled (gray cloud instead of orange) for `api` —
  TLS may not work

### Fix
- Re-add missing DNS record in Cloudflare dashboard
- Ensure orange cloud (proxy on) for all records

## See also

- [Architecture overview](/documentation/architecture/overview/)
- [Railway deployment](/documentation/deployment/railway/)
- [Cloudflare LIFF deployment](/documentation/deployment/cloudflare-liff/)
- [DB queries](/documentation/ops/db-queries/) — full diagnostic snippets
