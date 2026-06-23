import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { creditLedgerRepository } from '../../repositories/credit_ledger.js';

const router = Router();

router.get('/', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const user = userRepository.findById(session.uid);
  if (!user) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const recent = creditLedgerRepository.listByUserRecent(user.id, 10);

  res.status(200).json({
    balance_satang: user.credit_balance_satang,
    is_blocked: user.is_blocked,
    abuse_warning_count: user.abuse_warning_count,
    recent_transactions: recent,
  });
});

router.get('/history', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const limit = Math.min(
    Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50),
    200
  );
  const offset = Math.max(
    0,
    Number.parseInt(String(req.query.offset ?? '0'), 10) || 0
  );
  const entries = creditLedgerRepository.listByUserPaginated(
    session.uid,
    limit,
    offset
  );
  const total = creditLedgerRepository.countByUser(session.uid);
  res.status(200).json({
    entries,
    pagination: { limit, offset, total },
  });
});

export default router;
