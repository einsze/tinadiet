import { userRepository } from '../repositories/users.js';

export type ExpirePremiumResult = {
  started_at: string;
  finished_at: string;
  now_iso: string;
  dry_run: boolean;
  candidates: number;
  reverted: number;
  expired_user_ids: number[];
};

export const runExpirePremium = async (
  dryRun: boolean
): Promise<ExpirePremiumResult> => {
  const startedAt = new Date();
  const nowIso = startedAt.toISOString();
  const expired = userRepository.listExpiredPremium(nowIso);
  const expiredIds = expired.map((u) => u.id);

  let reverted = 0;
  if (!dryRun && expired.length > 0) {
    reverted = userRepository.revertAllExpired(nowIso);
  }

  const finishedAt = new Date();
  const result: ExpirePremiumResult = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    now_iso: nowIso,
    dry_run: dryRun,
    candidates: expired.length,
    reverted,
    expired_user_ids: expiredIds,
  };

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'jobs.expire_premium.done',
      dry_run: dryRun,
      candidates: result.candidates,
      reverted: result.reverted,
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
    })
  );

  return result;
};
