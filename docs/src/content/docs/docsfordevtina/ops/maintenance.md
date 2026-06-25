---
title: Maintenance Guide
description: Time-budget for ongoing maintenance — what to do daily, weekly, monthly, quarterly, annually, plus incident playbooks.
sidebar:
  order: 4
---

This is the **owner's operating manual** for Tina Diet post-launch. It
tells you what to look at, how often, and how long it should take.

The project is launch-ready + secured + documented. From here, day-to-day
overhead is intentionally light. **If you only have time for ONE thing
per week, do the [weekly health check](#weekly--15-20-min).**

## Time budget overview

| Cadence | Time | Triggered by |
|---|---|---|
| [Daily](#daily--5-10-min-when-active) | 5–10 min | Active user load (top-ups, support) |
| [Weekly](#weekly--15-20-min) | 15–20 min | Calendar (e.g. every Monday) |
| [Monthly](#monthly--12-hours) | 1–2 hours | First weekend of the month |
| [Quarterly](#quarterly--34-hours) | 3–4 hours | Calendar (Mar / Jun / Sep / Dec) |
| [Annual](#annual--1-day) | ~1 day | Late December / early January |
| [Incident](#incident-playbooks) | varies | When something breaks |

If maintenance falls behind, prioritize: **Daily → Weekly → Monthly →
Quarterly → Annual**. Skipping Annual one year is recoverable; skipping
weekly for a quarter is not.

## Daily — 5–10 min (when active)

You only need to do these on days when users are actually paying + sending
support requests.

### 1. Operator: Review pending top-ups

- Open [admin.tinadiet.com/payments/pending](https://admin.tinadiet.com/payments/pending)
- FIFO list shows oldest submission first
- Cross-check slip image vs. your bank statement
- Approve with the **actual** amount visible on the slip (operator-editable)
- SLA target: respond within 1–24 hours

When inflow grows enough that this exceeds 30 min/day, that's the signal
to add more operators or flip Omise to LIVE.

### 2. Owner: Monitor LINE support requests

- Open [LINE OA Manager → Chats](https://manager.line.biz/) → TinaDiet account
- Filter for unread / unanswered
- Users in "support mode" (those who typed `support` in chat) are waiting
  for a human reply — the bot auto-ACK'd them, now they need YOU
- Reply directly from the Chats tab (manual mode is the default)
- Try to respond within 24 h to keep trust

### 3. Glance at error rate

- Open [Railway dashboard](https://railway.app) → backend service → Logs
- Filter or search: `level=error`
- Yesterday's count > today's count is fine; if today's spiking, dig in

## Weekly — 15–20 min

Pick a fixed day (Monday morning works well). Block this on your calendar.

### 1. Health check snapshot

Run the [DB health check](/docsfordevtina/ops/db-queries/#1-quick-health-snapshot)
via Railway Console. Look for:

- `signups_last_7d` — growth direction
- `payments_pending` — anything stuck waiting > a few days?
- `chat_refusals / chat_msgs_total` ratio — if creeping up, time to refine
  consultation system prompt
- `food_logs_today` — engagement still healthy?

### 2. Cloudflare deploys

- Open Cloudflare dashboard → Workers & Pages
- Check `tinadiet-liff`, `tinadiet-admin`, `tinadiet-docs` last deploy
  status — should be green
- If a build is red, look at the error before pushing the next commit
  (don't pile on broken state)

### 3. Dependabot drift

- Visit [github.com/einsze/tinadiet/security/dependabot](https://github.com/einsze/tinadiet/security/dependabot)
- Note the count — if it jumps significantly week-over-week (e.g. +5),
  schedule the [monthly security patch round](#1-security-patches)
  earlier this month
- DO NOT merge auto-grouped Dependabot PRs without inspecting — see
  [feedback memory `feedback_dependabot_grouped_pr_risk.md`](../../../../memory/) or
  the precedent set in commits [`ef22a54`](https://github.com/einsze/tinadiet/commit/ef22a54) +
  [`c60bb4f`](https://github.com/einsze/tinadiet/commit/c60bb4f) (they
  mixed safe patches with breaking major bumps)

### 4. Push notification deliverability

- Check the daily summary push went out at 21:00 ICT yesterday
- Check the weekly summary push went out at 08:00 ICT this Monday
- Visit Railway logs and search `jobs.daily_summary.done` /
  `jobs.weekly_summary.done` — should show one log per scheduled time
- If missing, check `CRON_ENABLED`, `CRON_TZ`, and that the backend wasn't
  restarting at that minute

## Monthly — 1–2 hours

Block the first weekend of every month.

### 1. Security patches

In each project directory:

```bash
cd backend && npm audit && npm audit fix
cd ../liff && npm audit && npm audit fix
cd ../admin && npm audit && npm audit fix
cd ../docs && npm audit                  # plain audit only — docs accepts risk
```

**Important:** never pass `--force`. The default `npm audit fix` stays
within caret ranges (caret-safe). `--force` can introduce vite 5→8 / astro
5→7 type breaks that wreck Cloudflare Pages builds.

After the fix:

```bash
cd ../backend && npx tsc --noEmit
cd ../liff    && npx tsc -b && npm run build
cd ../admin   && npx tsc -b && npm run build
```

Commit + push if anything changed.

### 2. Credit-ledger reconciliation

Run the [reconciliation query](/docsfordevtina/payments/credit-system/#reconciliation-query)
via Railway Console. Empty result = healthy. **Any row = investigate
immediately** — the credit system invariant has been violated and you
need to find the leak.

### 3. Railway disk usage

- Railway dashboard → backend service → Metrics → Disk
- The volume is 1 GB Hobby plan
- `/data/app.db` should grow slowly (~10 KB / active user / month)
- `/data/slips/` grows by upload count × ~500 KB / slip
- If above 80%, plan a cleanup cron or migrate to a bigger plan

Quick disk check via Railway Console:

```bash
du -sh /data/app.db /data/slips/
df -h /data
```

### 4. OpenAI cost review

- Visit [platform.openai.com/usage](https://platform.openai.com/usage)
- Look at the last 30 days
- Per [reference/env-vars](/docsfordevtina/reference/env-vars/), our caps are
  `PHOTO_DAILY_LIMIT=10` + `CONSULT_DAILY_LIMIT=20` per user — so the upper
  bound per premium user is ~$0.005/day
- If real usage is significantly above projection, check for abusive
  users in [admin /users?flagged](https://admin.tinadiet.com/users?flagged)

### 5. Premium subscriber list audit

Spot-check 5 random premium users:

```bash
node -e 'const db=require("better-sqlite3")("/data/app.db");
const rows=db.prepare("SELECT id, display_name, plan, premium_expires_at FROM users WHERE plan=\"premium\" ORDER BY RANDOM() LIMIT 5").all();
console.table(rows);'
```

Verify expiry dates look right vs. when they last paid (cross-check with
`manual_payments`). Catches any accidental over-grant or stuck-extension
bugs early.

### 6. Cron job audit

- Look at past month's logs for `jobs.*.run_failed` events
- A few one-off failures are normal (LINE API blip, user blocked bot)
- Repeated daily failures = bug; investigate

### 7. Operator password hygiene (optional)

Owner has chosen to skip mandatory rotation, but if any operator suspects
their account is compromised:

- Operator self-rotates via `/account` page
- Or superadmin disables the row (`is_active=0`) and issues a new
  account via `/operators`

## Quarterly — 3–4 hours

Block one weekend per quarter (Mar / Jun / Sep / Dec).

### 1. PDPA flow verification

Test that account export + delete still work end-to-end with a throwaway
test account. See [Manual grants](/docsfordevtina/ops/manual-grants/) for
how to provision a test user.

- POST `/api/v1/account/export` → JSON bundle downloads
- POST `/api/v1/account/delete` with `confirm: 'DELETE'` → user row gone,
  all per-user tables cascade, slip files... still on disk (orphaned)

### 2. Real-bank PromptPay scan test

Top-up flow drift detection. Once a quarter, do a real 49 THB top-up
yourself:

- LIFF → Premium → Top up → Manual PromptPay → 49 THB
- Scan with a real Thai bank app (Kasikorn / SCB / Krungthai — rotate
  between them)
- Upload slip
- Admin (yourself, second account) approves
- Verify credit lands + bundle redeem works

Helps catch silent breakage in `services/promptpay_qr.ts` or the slip
upload path before users hit it.

### 3. Gift system smoke test

End-to-end: send a gift to a second test account, claim it. Verifies the
LIFF deep-link format ([invariant #15](/docsfordevtina/architecture/key-invariants/#15-liff-deep-links-for-in-line-urls))
+ the entire claim → entitlement chain still works.

### 4. Astro upgrade attempt (deferred items)

Current state: Astro 5 is pinned because Astro 6 needs Starlight
0.30→0.40+ compat work. Quarterly, check:

- Is Starlight latest compatible with Astro 6 stable? (changelogs +
  release notes)
- Is the [Dependabot count](https://github.com/einsze/tinadiet/security/dependabot)
  still at ~6 (docs-chain only) or has it crept?
- Try the upgrade in a branch: `cd docs && npm install astro@^6
  @astrojs/starlight@latest -D` → `npm run build` → fix issues

If it builds clean and the visual diff looks OK, merge. If not, stay on
Astro 5 another quarter — it's DEV-only attack surface.

### 5. Architecture invariant audit

Re-read [Key invariants](/docsfordevtina/architecture/key-invariants/).
Has any code bent any of them?

- Direct `UPDATE users SET credit_balance_satang = ...` anywhere?
  → Violation of #13 — fix immediately
- New webhook handler not behind `express.raw()`? → Violation of #2
- New `cron.schedule` missing `{ timezone }`? → Violation of #12

`grep -r "credit_balance_satang" backend/src/` is the quickest audit.

### 6. LINE Messaging API plan review

- Open [LINE Developers Console](https://developers.line.biz) → Messaging
  API channel → Statistics
- Check push quota usage (free tier = 500/month historically; current plan
  in `SECRETS_TINADIET_LOCAL.md`)
- If approaching limit, plan to upgrade plan or reduce push frequency
- Also check Webhook delivery success rate — should be > 99%

### 7. Slip storage cleanup decision

The slip files at `/data/slips/<uuid>.<ext>` are NOT cascade-deleted when
a user is hard-deleted (PDPA flow). They become orphans. Quarterly,
decide whether to:

- (a) Leave them (cheap storage, harmless)
- (b) Build a sweeper cron to delete files whose `manual_payments.id`
  no longer exists in DB

Trigger for (b) is the disk approaching 80% (see monthly check #3).

## Annual — ~1 day

Block one day in late December or early January.

### 1. Major version upgrades

In a branch, attempt the following one at a time:

- Node LTS check — if Node 26 is out, plan migration off 22 within 6
  months. Update `.nvmrc` + `engines.node` + Railway env + Cloudflare
  `NODE_VERSION`.
- Express 4 → 5 — has been "stable" for a year, evaluate.
- `@line/bot-sdk` major version — usually safe, follow LINE's migration
  guide.
- `openai` SDK major — strict JSON schema syntax has evolved; review.
- Astro / Starlight (if still deferred from quarterly attempts) — full
  upgrade session.
- React 18 → 19 — when stable.

For each, commit on a branch, push, verify Cloudflare builds, merge if
clean.

### 2. Privacy / Terms lawyer review

The privacy.md + terms.md are currently English-only DRAFT templates per
[Sprint 5 M1 closing note](/docsfordevtina/introduction/). Pre-launch
chore that's still open:

- Engage a Thai lawyer to review + translate
- Update `liff/src/legal/privacy.md` + `terms.md` with the Thai versions
- Re-submit to LINE OA Manager business verification

### 3. Stripe / Omise reactivation evaluation

- Has Thai card payment market shifted enough to want Stripe back?
  Probably not.
- Has Omise KYC come through? If yes, reactivate Omise per
  [payments/omise](/docsfordevtina/payments/omise/) — this is a real
  unlock (auto-payment, no operator manual review).

### 4. Domain + DNS audit

- Cloudflare Registrar tinadiet.com auto-renews — verify it's set to
  auto-renew
- Check DNS records: `app`, `admin`, `api`, root, `_dmarc`, etc. —
  anything obsolete?
- TLS certificate auto-renews via Cloudflare — verify all 3 subdomains
  show valid cert

### 5. Backup verification

Railway snapshots the volume regularly. Pretend `/data/app.db` got
corrupted — can you restore from a recent snapshot?

- Railway dashboard → backend volume → Backups
- Test restore to a staging service (not production!)
- Verify the restored DB opens + has recent data

### 6. Tech-debt audit

Re-read the project memory + decision rationale. Anything you've been
working around that should be properly fixed?

Common candidates:
- Hand-baked LINE OA Rich Menu vs API-managed
- Slip files orphans on user delete
- Stripe + Omise dormant code still in the bundle

## Incident playbooks

### LINE webhook failing

**Symptoms:** Users say bot doesn't reply to chat or photos. Or LINE OA
Manager shows webhook delivery failures.

**Diagnose:**

1. Visit `https://api.tinadiet.com/healthz` — should return 200 + recent
   `commit` SHA. If down → Railway issue, check status.railway.app
2. Railway logs: search `webhook.handler.error` for last hour
3. LINE Developers Console → Messaging API → Webhook → check delivery
   success rate + click "Verify" to test

**Common causes:**

- `LINE_CHANNEL_SECRET` rotated but Railway env not updated → signature
  verify fails on every request
- Railway deployment failed silently and reverted to an older buggy
  version → check Railway "Deployments" tab
- Backend crashed and Railway hasn't restarted yet → check Memory metrics

### PromptPay QR not generating

**Symptoms:** User taps "Top up manual" + gets `503` error.

**Diagnose:**

- Check `admin.tinadiet.com/settings` — `promptpay_id` configured?
  `promptpay_receiver_name` non-empty?
- Railway logs: search `topup.manual.start.failed`

**Fix:** Re-enter PromptPay receiver settings in admin (a common cause is
the value was wiped during a settings round-trip without all fields
filled in).

### Push notifications not arriving

**Symptoms:** Daily/weekly summary not in user's chat.

**Diagnose:**

- User may have blocked the bot — `safePush` swallows that error (logs
  `info` not `error`), so look for `jobs.daily_summary.push_failed`
- Or backend was down at 21:00 ICT → no push fired at all
- Cron disabled? Check `CRON_ENABLED=true` and `CRON_TZ=Asia/Bangkok`

**Fix:** Trigger manually via internal job endpoint:

```bash
curl -X POST \
  -H "x-jobs-secret: $JOBS_TRIGGER_SECRET" \
  "https://api.tinadiet.com/internal/jobs/daily-summary"
```

### Database lock / "database is locked" error

**Symptoms:** Random 500s with "database is locked" in logs.

**Diagnose:**

- better-sqlite3 is synchronous; locks are usually transient
- Concurrent long transaction holding write lock
- Look for `db.transaction()` blocks that do network I/O inside (anti-
  pattern — should never happen in our code)

**Fix:** Almost always self-recovers within seconds. If persistent,
restart the backend service in Railway. Investigate after stabilizing.

### Admin login fails for everyone

**Symptoms:** Operators report "Invalid email or password" even with
correct creds.

**Diagnose:**

- `ADMIN_JWT_SECRET` or `SESSION_JWT_SECRET` changed → all existing
  tokens invalid (expected behavior — they need to re-login)
- bcrypt verify failing for everyone → `admin_users.password_hash`
  column got corrupted somehow → check via Railway Console
- Backend route panic — check Railway logs

**Fix:**

```bash
# Reset a superadmin password directly via Railway Console (last resort)
node -e '
const bcrypt = require("bcryptjs");
const db = require("better-sqlite3")("/data/app.db");
const hash = bcrypt.hashSync("NEW_PASSWORD_HERE", 10);
db.prepare("UPDATE admin_users SET password_hash=? WHERE email=?")
  .run(hash, "superadmin-email@example.com");
console.log("done");
'
```

### Cloudflare build red

**Symptoms:** Push to main, Cloudflare Pages or Workers build shows
FAILURE on the GitHub PR / status check.

**Diagnose:**

- Click "Details" link on the failed check → opens Cloudflare build log
- Look at the last 30–50 lines for the actual error
- Common: missing env var, broken import, vite/astro config mismatch
- Per [memory `feedback_cloudflare_uses_tsc_b`](../../../../memory/),
  Cloudflare runs `tsc -b && vite build` which is stricter than local
  `tsc --noEmit` — run the exact same command locally to reproduce

**Fix:** Patch the issue, push again. Don't merge over a red build.

## Cost monitoring

| Item | Where to check | Typical | Trigger to escalate |
|---|---|---|---|
| Railway Hobby plan | [railway.app/billing](https://railway.app) | $5 / mo | Service running > 8 GB RAM or > 1 GB volume |
| Cloudflare | dashboard | Free tier | If we add Cloudflare Access or large file egress |
| LINE Messaging API | LINE Bill | varies | Push quota usage > 50% of plan |
| OpenAI | [platform.openai.com/usage](https://platform.openai.com/usage) | varies | Daily spend > 2x weekly average |
| tinadiet.com domain | Cloudflare Registrar | ~$10 / yr | Auto-renew failure |
| Email (Cloudflare Email Routing) | dashboard | Free | Adding > 200 forward rules |

If any of these spike unexpectedly, that's an incident — not a routine.

## When to call dev (escalate)

You can handle most of the above yourself. Call in the dev (engineer
contact — whoever built or last maintained the project) for:

- 🚨 Database corruption / can't restore from backup
- 🚨 Customer reports lost credit / wrong premium grant + you can't
  reconcile from the ledger
- 🚨 Repeated 5xx errors after a recent deploy that you can't roll back
- 🚨 LINE OA channel suspended or business verification revoked
- 🟠 Major version upgrade (Node, Express, OpenAI SDK) — risky enough to
  pair-program
- 🟠 New feature request from the client — scoping + planning sessions
- 🟠 Cloudflare Access / Cloudflare Workers config changes — easy to
  break the deploy chain
- 🟡 Anything where you'd write "I'm not sure if this is safe to do" in
  Slack — that's the signal

## Quick command reference

| What | Command |
|---|---|
| Backend health | `curl https://api.tinadiet.com/healthz` |
| Local typecheck | `cd backend && npx tsc --noEmit` (and same in liff/admin with `tsc -b`) |
| Run audit | `npm audit` (in any project subdir) |
| Apply safe fixes | `npm audit fix` (NEVER add `--force`) |
| Trigger daily summary | `curl -X POST -H "x-jobs-secret: $JOBS_TRIGGER_SECRET" https://api.tinadiet.com/internal/jobs/daily-summary` |
| Dry-run weekly summary | append `?dry_run=true` to above |
| Reconcile credit ledger | See [credit system](/docsfordevtina/payments/credit-system/#reconciliation-query) |
| Pending top-ups admin URL | [admin.tinadiet.com/payments/pending](https://admin.tinadiet.com/payments/pending) |
| Settings admin URL | [admin.tinadiet.com/settings](https://admin.tinadiet.com/settings) |
| Railway logs | [railway.app](https://railway.app) → backend service → Logs |
| LINE OA Chats | [manager.line.biz](https://manager.line.biz) → TinaDiet → Chats |

## What this guide intentionally doesn't cover

- **Feature development** — see backend / LIFF stack docs + key invariants
- **Onboarding new operators** — see [Admin overview](/docsfordevtina/admin/overview/)
- **Adding new languages** — Thai-first is a UX invariant; localization
  is a different project
- **Marketing / growth** — not a code concern
