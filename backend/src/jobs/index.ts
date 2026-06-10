import cron from 'node-cron';
import { env } from '../config/env.js';
import { runDailySummary } from './daily_summary.js';
import { runWeeklySummary } from './weekly_summary.js';
import { runExpirePremium } from './expire_premium.js';

let _started = false;

export const startCronJobs = (): void => {
  if (_started) return;
  if (!env.CRON_ENABLED) {
    console.log(
      JSON.stringify({ level: 'info', msg: 'jobs.cron.disabled_by_env' })
    );
    return;
  }

  cron.schedule(
    env.DAILY_SUMMARY_CRON,
    () => {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'jobs.daily_summary.tick',
          schedule: env.DAILY_SUMMARY_CRON,
          tz: env.CRON_TZ,
        })
      );
      runDailySummary(false).catch((err: unknown) => {
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'jobs.daily_summary.run_failed',
            error: err instanceof Error ? err.message : String(err),
          })
        );
      });
    },
    { timezone: env.CRON_TZ }
  );

  cron.schedule(
    env.WEEKLY_SUMMARY_CRON,
    () => {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'jobs.weekly_summary.tick',
          schedule: env.WEEKLY_SUMMARY_CRON,
          tz: env.CRON_TZ,
        })
      );
      runWeeklySummary(false).catch((err: unknown) => {
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'jobs.weekly_summary.run_failed',
            error: err instanceof Error ? err.message : String(err),
          })
        );
      });
    },
    { timezone: env.CRON_TZ }
  );

  cron.schedule(
    env.EXPIRE_PREMIUM_CRON,
    () => {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'jobs.expire_premium.tick',
          schedule: env.EXPIRE_PREMIUM_CRON,
          tz: env.CRON_TZ,
        })
      );
      runExpirePremium(false).catch((err: unknown) => {
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'jobs.expire_premium.run_failed',
            error: err instanceof Error ? err.message : String(err),
          })
        );
      });
    },
    { timezone: env.CRON_TZ }
  );

  _started = true;
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'jobs.cron.scheduled',
      daily_schedule: env.DAILY_SUMMARY_CRON,
      weekly_schedule: env.WEEKLY_SUMMARY_CRON,
      expire_premium_schedule: env.EXPIRE_PREMIUM_CRON,
      tz: env.CRON_TZ,
    })
  );
};
