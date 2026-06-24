import { db } from '../db/sqlite.js';
import { giftsRepository } from '../repositories/gifts.js';
import { grantCredit } from '../services/credit.js';
import { notifyGiftExpired } from '../services/gifts.js';

export type ExpireGiftsUserResult = {
  gift_id: number;
  sender_user_id: number;
  refunded_satang: number;
  status: 'expired' | 'skipped' | 'failed';
  error?: string;
};

export type ExpireGiftsResult = {
  started_at: string;
  finished_at: string;
  now_iso: string;
  dry_run: boolean;
  candidates: number;
  expired: number;
  failed: number;
  results: ExpireGiftsUserResult[];
};

export const runExpireGifts = async (
  dryRun: boolean
): Promise<ExpireGiftsResult> => {
  const startedAt = new Date();
  const nowIso = startedAt.toISOString();
  const candidates = giftsRepository.listExpiringPending(nowIso);
  const results: ExpireGiftsUserResult[] = [];

  let expired = 0;
  let failed = 0;

  for (const gift of candidates) {
    if (dryRun) {
      results.push({
        gift_id: gift.id,
        sender_user_id: gift.sender_user_id,
        refunded_satang: gift.credit_spent_satang,
        status: 'skipped',
      });
      continue;
    }

    try {
      db.transaction(() => {
        const ok = giftsRepository.markExpired(gift.id);
        if (!ok) {
          // race: another process already handled
          return;
        }
        grantCredit({
          user_id: gift.sender_user_id,
          amount_satang: gift.credit_spent_satang,
          source_type: 'gift_refund',
          source_ref_id: gift.id,
          admin_user_id: null,
          note: `Gift expired by cron (id=${gift.id})`,
        });
      })();
      expired += 1;
      // fire-and-forget push notif
      const fresh = giftsRepository.findById(gift.id);
      if (fresh !== undefined && fresh.status === 'expired') {
        void notifyGiftExpired(fresh);
      }
      results.push({
        gift_id: gift.id,
        sender_user_id: gift.sender_user_id,
        refunded_satang: gift.credit_spent_satang,
        status: 'expired',
      });
    } catch (err) {
      failed += 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'jobs.expire_gifts.failed',
          gift_id: gift.id,
          error: errMsg,
        })
      );
      results.push({
        gift_id: gift.id,
        sender_user_id: gift.sender_user_id,
        refunded_satang: 0,
        status: 'failed',
        error: errMsg,
      });
    }
  }

  const finishedAt = new Date();
  const result: ExpireGiftsResult = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    now_iso: nowIso,
    dry_run: dryRun,
    candidates: candidates.length,
    expired,
    failed,
    results,
  };

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'jobs.expire_gifts.done',
      dry_run: dryRun,
      candidates: result.candidates,
      expired,
      failed,
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
    })
  );

  return result;
};
