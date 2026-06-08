import { lineClient } from '../line/client.js';
import { foodLogsRepository } from '../repositories/food_logs.js';
import { userRepository } from '../repositories/users.js';
import { weightLogsRepository } from '../repositories/weight_logs.js';
import { todayInTimezone } from '../domain/date.js';
import type { User } from '../domain/types.js';

export type WeeklySummaryUserResult = {
  db_user_id: number;
  line_user_id: string;
  range_start: string;
  range_end: string;
  status: 'pushed' | 'dry_run' | 'failed';
  avg_kcal: number;
  goal: number | null;
  days_logged: number;
  text?: string;
  error?: string;
};

export type WeeklySummaryResult = {
  started_at: string;
  finished_at: string;
  total_candidates: number;
  pushed: number;
  failed: number;
  results: WeeklySummaryUserResult[];
};

const daysAgo = (yyyymmdd: string, n: number): string => {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

export const formatWeeklySummary = (
  user: User,
  rangeStart: string,
  rangeEnd: string
): string => {
  const agg = foodLogsRepository.weeklyAggregate(user.id, rangeStart, rangeEnd);
  const lines: string[] = ['📅 สรุปสัปดาห์ที่ผ่านมา', ''];
  lines.push(`บันทึก ${agg.days_logged} / 7 วัน`);

  if (agg.days_logged === 0) {
    lines.push('');
    lines.push('สัปดาห์นี้ยังไม่ได้บันทึกเลยค่ะ');
    lines.push('ลองบอก Tina ว่าทานอะไรในแชตนะคะ 💪');
    return lines.join('\n');
  }

  const avgKcal = Math.round(agg.sum_kcal / agg.days_logged);
  const goal = user.daily_calorie_goal;

  lines.push(`เฉลี่ย: ${avgKcal} kcal/วัน`);
  if (goal !== null) {
    lines.push(`เป้าหมาย: ${goal} kcal/วัน`);
    const diff = avgKcal - goal;
    lines.push('');
    if (Math.abs(diff) <= goal * 0.05) {
      lines.push('ทำได้ดีมาก! อยู่ในเป้าตลอดสัปดาห์ ✨');
    } else if (diff > 0) {
      lines.push(`สัปดาห์นี้เกินเป้าเฉลี่ย ${diff} kcal/วัน`);
    } else {
      lines.push(`สัปดาห์นี้ต่ำกว่าเป้าเฉลี่ย ${Math.abs(diff)} kcal/วัน`);
    }
  }

  if (
    user.daily_protein_g !== null &&
    user.daily_carbs_g !== null &&
    user.daily_fat_g !== null
  ) {
    const avgP = Math.round(agg.sum_protein_g / agg.days_logged);
    const avgC = Math.round(agg.sum_carbs_g / agg.days_logged);
    const avgF = Math.round(agg.sum_fat_g / agg.days_logged);
    lines.push('');
    lines.push('Macros เฉลี่ย/วัน:');
    lines.push(`· Protein ${avgP}g / ${user.daily_protein_g}g`);
    lines.push(`· Carbs ${avgC}g / ${user.daily_carbs_g}g`);
    lines.push(`· Fat ${avgF}g / ${user.daily_fat_g}g`);
  }

  const latest = weightLogsRepository.latest(user.id);
  if (latest !== undefined && user.target_weight_kg !== null) {
    const diff = latest.weight_kg - user.target_weight_kg;
    lines.push('');
    lines.push(`น้ำหนักล่าสุด: ${latest.weight_kg} kg`);
    if (Math.abs(diff) < 0.5) {
      lines.push('ถึงเป้าหมายแล้ว 🎯');
    } else if (diff > 0) {
      lines.push(`ห่างจากเป้า ${diff.toFixed(1)} kg`);
    } else {
      lines.push(`ขาดอีก ${Math.abs(diff).toFixed(1)} kg`);
    }
  }

  return lines.join('\n');
};

export const runWeeklySummary = async (
  dryRun: boolean
): Promise<WeeklySummaryResult> => {
  const startedAt = new Date().toISOString();
  const candidates = userRepository.listProfileCompleted();
  const results: WeeklySummaryUserResult[] = [];

  let pushed = 0;
  let failed = 0;

  for (const user of candidates) {
    const today = todayInTimezone(user.timezone);
    const rangeStart = daysAgo(today, 6);
    const rangeEnd = today;
    const text = formatWeeklySummary(user, rangeStart, rangeEnd);
    const agg = foodLogsRepository.weeklyAggregate(user.id, rangeStart, rangeEnd);
    const avgKcal =
      agg.days_logged > 0 ? Math.round(agg.sum_kcal / agg.days_logged) : 0;

    if (dryRun) {
      results.push({
        db_user_id: user.id,
        line_user_id: user.line_user_id,
        range_start: rangeStart,
        range_end: rangeEnd,
        status: 'dry_run',
        avg_kcal: avgKcal,
        goal: user.daily_calorie_goal,
        days_logged: agg.days_logged,
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
        range_start: rangeStart,
        range_end: rangeEnd,
        status: 'pushed',
        avg_kcal: avgKcal,
        goal: user.daily_calorie_goal,
        days_logged: agg.days_logged,
      });
    } catch (err) {
      failed += 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'jobs.weekly_summary.push_failed',
          db_user_id: user.id,
          error: errMsg,
        })
      );
      results.push({
        db_user_id: user.id,
        line_user_id: user.line_user_id,
        range_start: rangeStart,
        range_end: rangeEnd,
        status: 'failed',
        avg_kcal: avgKcal,
        goal: user.daily_calorie_goal,
        days_logged: agg.days_logged,
        error: errMsg,
      });
    }
  }

  const finishedAt = new Date().toISOString();
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'jobs.weekly_summary.done',
      started_at: startedAt,
      finished_at: finishedAt,
      total_candidates: candidates.length,
      pushed,
      failed,
      dry_run: dryRun,
    })
  );

  return {
    started_at: startedAt,
    finished_at: finishedAt,
    total_candidates: candidates.length,
    pushed,
    failed,
    results,
  };
};
