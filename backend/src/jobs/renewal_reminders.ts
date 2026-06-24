import { lineClient } from '../line/client.js';
import { userRepository } from '../repositories/users.js';
import { todayInTimezone } from '../domain/date.js';
import type { User } from '../domain/types.js';

const REMINDER_OFFSETS = [3, 1, 0] as const;
type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

const TIMEZONE = 'Asia/Bangkok';

const addDaysToLocalDate = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
};

export const formatRenewalReminder = (daysLeft: ReminderOffset): string => {
  const lines: string[] = ['⭐ Premium ของคุณ', ''];
  if (daysLeft === 0) {
    lines.push('Premium จะหมดอายุวันนี้ค่ะ');
  } else if (daysLeft === 1) {
    lines.push('Premium จะหมดอายุพรุ่งนี้ค่ะ');
  } else {
    lines.push(`Premium จะหมดอายุในอีก ${daysLeft} วันค่ะ`);
  }
  lines.push('อย่าลืมเตรียม credit ให้พอเพื่อใช้งาน premium ต่อนะคะ 💖');
  return lines.join('\n');
};

export type RenewalReminderUserResult = {
  db_user_id: number;
  line_user_id: string;
  days_left: ReminderOffset;
  target_date: string;
  premium_expires_at: string | null;
  status: 'pushed' | 'dry_run' | 'failed';
  text?: string;
  error?: string;
};

export type RenewalReminderResult = {
  started_at: string;
  finished_at: string;
  today: string;
  buckets: Record<ReminderOffset, number>;
  total_candidates: number;
  pushed: number;
  failed: number;
  results: RenewalReminderUserResult[];
};

export const runRenewalReminders = async (
  dryRun: boolean
): Promise<RenewalReminderResult> => {
  const startedAt = new Date().toISOString();
  const today = todayInTimezone(TIMEZONE);
  const results: RenewalReminderUserResult[] = [];
  const buckets: Record<ReminderOffset, number> = { 3: 0, 1: 0, 0: 0 };

  let pushed = 0;
  let failed = 0;

  for (const offset of REMINDER_OFFSETS) {
    const targetDate = addDaysToLocalDate(today, offset);
    const candidates: User[] =
      userRepository.listExpiringOnLocalDate(targetDate);
    buckets[offset] = candidates.length;

    for (const user of candidates) {
      const text = formatRenewalReminder(offset);

      if (dryRun) {
        results.push({
          db_user_id: user.id,
          line_user_id: user.line_user_id,
          days_left: offset,
          target_date: targetDate,
          premium_expires_at: user.premium_expires_at,
          status: 'dry_run',
          text,
        });
        continue;
      }

      try {
        await lineClient.pushMessage({
          to: user.line_user_id,
          messages: [{ type: 'text', text }],
        });
        pushed += 1;
        results.push({
          db_user_id: user.id,
          line_user_id: user.line_user_id,
          days_left: offset,
          target_date: targetDate,
          premium_expires_at: user.premium_expires_at,
          status: 'pushed',
        });
      } catch (err) {
        failed += 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'jobs.renewal_reminders.push_failed',
            db_user_id: user.id,
            line_user_id: user.line_user_id,
            days_left: offset,
            error: errMsg,
          })
        );
        results.push({
          db_user_id: user.id,
          line_user_id: user.line_user_id,
          days_left: offset,
          target_date: targetDate,
          premium_expires_at: user.premium_expires_at,
          status: 'failed',
          error: errMsg,
        });
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const totalCandidates = buckets[3] + buckets[1] + buckets[0];

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'jobs.renewal_reminders.done',
      started_at: startedAt,
      finished_at: finishedAt,
      today,
      buckets,
      total_candidates: totalCandidates,
      pushed,
      failed,
      dry_run: dryRun,
    })
  );

  return {
    started_at: startedAt,
    finished_at: finishedAt,
    today,
    buckets,
    total_candidates: totalCandidates,
    pushed,
    failed,
    results,
  };
};
