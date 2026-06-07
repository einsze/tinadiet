import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { foodLogsRepository } from '../../repositories/food_logs.js';
import { isValidIsoDate, todayInTimezone } from '../../domain/date.js';

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

  const dateParam = typeof req.query.date === 'string' ? req.query.date : null;
  const date =
    dateParam !== null && isValidIsoDate(dateParam)
      ? dateParam
      : todayInTimezone(user.timezone);

  if (dateParam !== null && !isValidIsoDate(dateParam)) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'date must be YYYY-MM-DD',
      },
    });
    return;
  }

  const logs = foodLogsRepository.listByUserAndDate(user.id, date);
  const totals = foodLogsRepository.totalsByUserAndDate(user.id, date);

  res.status(200).json({ date, logs, totals });
});

export default router;
