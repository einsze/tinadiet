---
title: Background Jobs
description: Cron schedule, handler structure, manual triggering.
sidebar:
  order: 5
---

Background jobs run on `node-cron` inside the same backend process. All
scheduled in `Asia/Bangkok` timezone.

## Schedule

| Job | Schedule | Default cron expr | Env var |
|---|---|---|---|
| Daily summary | 21:00 ICT | `0 21 * * *` | `DAILY_SUMMARY_CRON` |
| Weekly summary | Monday 08:00 ICT | `0 8 * * 1` | `WEEKLY_SUMMARY_CRON` |
| Expire premium | 02:00 ICT | `0 2 * * *` | `EXPIRE_PREMIUM_CRON` |
| Renewal reminders (PLANNED) | 10:00 ICT | `0 10 * * *` | `RENEWAL_REMINDERS_CRON` |

The "renewal reminders" job is Sprint 6 M3 work, not yet shipped.

## Anatomy of a job

Two files per job:

```
backend/src/jobs/
├── <name>.ts        # the handler — runXxx(dryRun) → result
└── index.ts         # all schedules registered here
```

### Handler pattern

```ts
import { someRepository } from '../repositories/some.js';

export type RunResult = {
  started_at: string;
  finished_at: string;
  dry_run: boolean;
  affected: number;
  // ... job-specific stats
};

export const runDailySummary = async (
  dryRun: boolean
): Promise<RunResult> => {
  const startedAt = new Date();
  // ... do work; check dryRun before mutation

  const finishedAt = new Date();
  const result: RunResult = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    dry_run: dryRun,
    affected: 0,
  };

  console.log(JSON.stringify({
    level: 'info',
    msg: 'jobs.daily_summary.done',
    ...result,
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
  }));

  return result;
};
```

Key conventions:
- Takes a `dryRun: boolean` — supports testing without side effects
- Returns a result object with timing + stats
- Logs structured JSON at start + done
- Throws on unrecoverable errors (caller catches + logs)

### Scheduling in `jobs/index.ts`

```ts
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runDailySummary } from './daily_summary.js';

let _started = false;

export const startCronJobs = (): void => {
  if (_started) return;
  if (!env.CRON_ENABLED) {
    console.log(JSON.stringify({ level: 'info', msg: 'jobs.cron.disabled_by_env' }));
    return;
  }

  cron.schedule(
    env.DAILY_SUMMARY_CRON,
    () => {
      console.log(JSON.stringify({
        level: 'info',
        msg: 'jobs.daily_summary.tick',
        schedule: env.DAILY_SUMMARY_CRON,
        tz: env.CRON_TZ,
      }));
      runDailySummary(false).catch((err) => {
        console.error(JSON.stringify({
          level: 'error',
          msg: 'jobs.daily_summary.run_failed',
          error: err instanceof Error ? err.message : String(err),
        }));
      });
    },
    { timezone: env.CRON_TZ }
  );

  // ... more cron.schedule calls

  _started = true;
};
```

**Always pass `{ timezone: env.CRON_TZ }`** ([rule 12 in invariants](/documentation/architecture/key-invariants/#12-always-pass-timezone-to-node-cron)).
Default `env.CRON_TZ` is `Asia/Bangkok`.

## Manual triggers

Each job has a `POST /internal/jobs/<name>` endpoint guarded by
`x-jobs-secret` header.

```bash
# Dry-run daily summary (no LINE push, just log what would be sent)
curl -X POST \
  -H "x-jobs-secret: $JOBS_TRIGGER_SECRET" \
  "https://api.tinadiet.com/internal/jobs/daily-summary?dry_run=true"

# Actually run it (sends pushes)
curl -X POST \
  -H "x-jobs-secret: $JOBS_TRIGGER_SECRET" \
  "https://api.tinadiet.com/internal/jobs/daily-summary"
```

## Existing jobs

### `daily_summary.ts`

- Selects users with `daily_calorie_goal IS NOT NULL` (profile complete)
- For each: computes today's totals from `food_logs`, formats Thai message
  with feedback (under 70% → "กินน้อย", ≤105% → "เยี่ยมมาก", over → "เกินเป้า")
- Appends streak badge if ≥ 2 consecutive days logged
- Pushes via LINE Push API (catches per-user errors so batch doesn't fail)

### `weekly_summary.ts`

- Runs Monday morning, summarizes the prior 7 days
- `foodLogsRepository.weeklyAggregate` returns sum + log_count + days_logged
- Includes avg daily kcal vs goal + macro breakdown + weight trend
- Pushes via LINE Push API

### `expire_premium.ts`

- Selects users with `plan='premium' AND premium_expires_at <= now`
- Updates them to `plan='free', premium_expires_at=NULL`
- Single batch UPDATE (no per-user push, transparent expiry)
- Caller can `dry_run=true` to preview

### `renewal_reminders.ts` (PLANNED — Sprint 6 M3)

Will push LINE notifications to users with premium expiring in 3 days, 1
day, or today. Message: "Premium ของคุณจะหมดอายุใน X วัน — แตะปุ่ม
Premium เพื่อต่ออายุค่ะ".

## Why not external cron (e.g. cloud scheduler)?

We could have used Railway's cron feature or an external scheduler hitting
HTTP endpoints. Pros: separate process can be killed/restarted
independently; clearer separation of concerns.

For now, **node-cron inside the backend process** is fine because:
- Backend already has access to all repositories
- Cron jobs don't need to scale independently
- Failure isolation: a failing cron tick doesn't crash the web process
  (caught in `.catch()`)
- Cost: zero (no extra process)

If we add many more jobs or one becomes long-running, revisit. For now,
keep simple.
