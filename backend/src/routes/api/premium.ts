import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import {
  redeemPremium,
  getAllBundlePrices,
  PremiumRedemptionError,
  type PremiumBundle,
} from '../../services/premium_redemption.js';
import { isPremium } from '../../domain/profile.js';

const router = Router();

const redeemBodySchema = z.object({
  months: z.union([
    z.literal(1),
    z.literal(3),
    z.literal(6),
    z.literal(12),
    z.literal('7d'),
  ]),
});

router.get('/bundles', requireAuth, (_req: Request, res: Response) => {
  const prices = getAllBundlePrices();
  res.status(200).json({
    // `months` carries either a numeric month count or the string '7d' for
    // the day-based bundle. LIFF treats it as the bundle identifier.
    bundles: [
      { months: '7d', credit_required: prices['7d'] },
      { months: 1, credit_required: prices[1] },
      { months: 3, credit_required: prices[3] },
      { months: 6, credit_required: prices[6] },
      { months: 12, credit_required: prices[12] },
    ],
  });
});

router.post('/redeem', requireAuth, (req: Request, res: Response) => {
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

  const parse = redeemBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'months must be one of 1, 3, 6, 12, or "7d"',
      },
    });
    return;
  }

  try {
    const result = redeemPremium(user.id, parse.data.months as PremiumBundle);
    res.status(200).json({
      bundle_months: result.bundle_months,
      credit_spent_satang: result.credit_spent_satang,
      premium_expires_at: result.new_premium_expires_at,
      credit_balance_satang: result.user.credit_balance_satang,
      is_premium: isPremium(result.user),
    });
  } catch (err) {
    if (err instanceof PremiumRedemptionError) {
      const httpStatus =
        err.code === 'INSUFFICIENT_CREDIT'
          ? 402
          : err.code === 'USER_NOT_FOUND'
            ? 404
            : err.code === 'BUNDLE_NOT_CONFIGURED'
              ? 503
              : 400;
      res.status(httpStatus).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'premium.redeem.failed',
        db_user_id: user.id,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' },
    });
  }
});

export default router;
