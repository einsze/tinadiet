import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { weightLogsRepository } from '../../repositories/weight_logs.js';

const router = Router();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 365;

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

  const limitParam = req.query.limit;
  let limit = DEFAULT_LIMIT;
  if (typeof limitParam === 'string') {
    const n = Number(limitParam);
    if (Number.isInteger(n) && n > 0) {
      limit = Math.min(n, MAX_LIMIT);
    }
  }

  const logs = weightLogsRepository.listRecent(user.id, limit);
  const latest = weightLogsRepository.latest(user.id);

  res.status(200).json({
    logs,
    latest: latest ?? null,
    target_weight_kg: user.target_weight_kg,
    current_weight_kg: user.current_weight_kg,
  });
});

export default router;
