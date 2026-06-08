import { lineClient } from '../line/client.js';
import { foodLogsRepository } from '../repositories/food_logs.js';
import { userRepository } from '../repositories/users.js';
import { todayInTimezone } from '../domain/date.js';
import type { FoodLogTotals, User } from '../domain/types.js';

export type DailySummaryUserResult = {
  db_user_id: number;
  line_user_id: string;
  date: string;
  status: 'pushed' | 'dry_run' | 'failed';
  kcal: number;
  goal: number | null;
  item_count: number;
  text?: string;
  error?: string;
};

export type DailySummaryResult = {
  started_at: string;
  finished_at: string;
  total_candidates: number;
  pushed: number;
  failed: number;
  results: DailySummaryUserResult[];
};

export const formatDailySummary = (
  user: User,
  totals: FoodLogTotals
): string => {
  const goal = user.daily_calorie_goal;
  const consumed = totals.kcal;

  if (totals.count === 0) {
    return [
      '🌙 สรุปวันนี้',
      '',
      'ยังไม่ได้บันทึกอาหารเลยค่ะ',
      'พรุ่งนี้ลองบอก Tina ว่าทานอะไรนะคะ 💪',
    ].join('\n');
  }

  const lines: string[] = ['🌙 สรุปวันนี้', ''];
  lines.push(`ทาน ${totals.count} รายการ · ${consumed} kcal`);

  if (goal !== null) {
    const remaining = goal - consumed;
    lines.push(`เป้าหมาย: ${goal} kcal`);
    lines.push('');
    if (consumed < goal * 0.7) {
      lines.push(`กินน้อยไปนิด เหลือ ${remaining} kcal — พรุ่งนี้ทานเต็มที่นะคะ`);
    } else if (consumed <= goal * 1.05) {
      lines.push('เยี่ยมมาก! อยู่ในเป้าหมายค่ะ ✨');
    } else if (consumed <= goal * 1.15) {
      lines.push(`เกินเป้าไปนิดหน่อย (${consumed - goal} kcal) — พรุ่งนี้คุมหน่อยนะคะ`);
    } else {
      lines.push(`เกินเป้าไปเยอะ (${consumed - goal} kcal) — พรุ่งนี้กินคลีนหน่อยนะคะ 🥗`);
    }
  } else {
    lines.push('');
    lines.push('ตั้งเป้าหมายแคลในแอปเพื่อดูคำแนะนำได้นะคะ');
  }

  if (
    user.daily_protein_g !== null &&
    user.daily_carbs_g !== null &&
    user.daily_fat_g !== null
  ) {
    lines.push('');
    lines.push('Macros:');
    lines.push(`· Protein ${totals.protein_g}g / ${user.daily_protein_g}g`);
    lines.push(`· Carbs ${totals.carbs_g}g / ${user.daily_carbs_g}g`);
    lines.push(`· Fat ${totals.fat_g}g / ${user.daily_fat_g}g`);
  }

  return lines.join('\n');
};

export const runDailySummary = async (
  dryRun: boolean
): Promise<DailySummaryResult> => {
  const startedAt = new Date().toISOString();
  const candidates = userRepository.listProfileCompleted();
  const results: DailySummaryUserResult[] = [];

  let pushed = 0;
  let failed = 0;

  for (const user of candidates) {
    const date = todayInTimezone(user.timezone);
    const totals = foodLogsRepository.totalsByUserAndDate(user.id, date);
    const text = formatDailySummary(user, totals);

    if (dryRun) {
      results.push({
        db_user_id: user.id,
        line_user_id: user.line_user_id,
        date,
        status: 'dry_run',
        kcal: totals.kcal,
        goal: user.daily_calorie_goal,
        item_count: totals.count,
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
        date,
        status: 'pushed',
        kcal: totals.kcal,
        goal: user.daily_calorie_goal,
        item_count: totals.count,
      });
    } catch (err) {
      failed += 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'jobs.daily_summary.push_failed',
          db_user_id: user.id,
          line_user_id: user.line_user_id,
          error: errMsg,
        })
      );
      results.push({
        db_user_id: user.id,
        line_user_id: user.line_user_id,
        date,
        status: 'failed',
        kcal: totals.kcal,
        goal: user.daily_calorie_goal,
        item_count: totals.count,
        error: errMsg,
      });
    }
  }

  const finishedAt = new Date().toISOString();
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'jobs.daily_summary.done',
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
