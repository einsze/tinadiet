# Incident Runbook (template)

Severity ladder, on-call expectations, and step-by-step playbooks. Solo-dev
phase: best-effort response within business hours; no formal SLA.

## Severity

| Sev | Examples | Response time |
|---|---|---|
| S1 | Webhook 5xx storm; OpenAI billing alarm; data loss | <30 min |
| S2 | LIFF white screen; subscription webhook stalled | <2 h |
| S3 | Cosmetic, one user affected | next working day |

## Common playbooks

### S1 - LINE webhook 5xx storm
1. Open Sentry -> filter `route:/webhook/line` last 1h.
2. Check Railway logs (`railway logs --tail`).
3. If OpenAI is the culprit: flip `FEATURE_AI_REPLIES=false` -> chatbot responds
   with a friendly "we're updating, try again soon" message.
4. Open status post on LINE OA (optional).
5. Once fixed, re-enable the flag and post-mortem within 48h.

### S1 - OpenAI cost spike
1. Check `ai_usage` ledger for the offending user / endpoint.
2. Lower `AI_DAILY_BUDGET_*` env values; redeploy.
3. If abuse: ban the LINE user ID via admin script.

### S2 - Subscription webhook stalled
1. Stripe dashboard -> Webhooks -> Events -> filter failed.
2. Re-send failed events (Stripe supports per-event retry).
3. If our handler is the issue, fix and redeploy; Stripe will keep retrying.

### S1 - Suspected data corruption
1. STOP all writes: flip `MAINTENANCE_MODE=true` env -> redeploy.
2. Snapshot current DB.
3. Restore latest known-good backup to a new file.
4. Diff; recover affected rows.
5. Resume traffic.

### Restore-test drill (monthly)
1. Copy last weekly B2 backup locally.
2. Boot backend with `DATABASE_URL=file:./restored.db`.
3. Verify: count users, count food_logs last 7 days, a random user's daily summary.
4. Record drill outcome in `docs/runbooks/restore-drills.md`.
