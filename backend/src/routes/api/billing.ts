import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { subscriptionsRepository } from '../../repositories/subscriptions.js';
import {
  createCheckoutSession,
  cancelSubscriptionAtPeriodEnd,
  StripeServiceError,
} from '../../services/stripe.js';
import { isPremium } from '../../domain/profile.js';
import { env } from '../../config/env.js';

const router = Router();

router.get('/status', requireAuth, (req: Request, res: Response) => {
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

  const subscription = subscriptionsRepository.findLatestByUser(user.id);
  const stripeConfigured =
    env.STRIPE_SECRET_KEY.length > 0 && env.STRIPE_PRICE_ID.length > 0;

  res.status(200).json({
    plan: user.plan,
    is_premium: isPremium(user),
    premium_expires_at: user.premium_expires_at,
    subscription:
      subscription !== undefined
        ? {
            provider: subscription.provider,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at,
          }
        : null,
    pricing: {
      currency: 'THB',
      amount: 150,
      interval: 'month',
    },
    stripe_configured: stripeConfigured,
  });
});

router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
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

  if (isPremium(user)) {
    res.status(409).json({
      error: {
        code: 'ALREADY_PREMIUM',
        message: 'You already have an active premium subscription',
      },
      premium_expires_at: user.premium_expires_at,
    });
    return;
  }

  if (env.STRIPE_SECRET_KEY.length === 0 || env.STRIPE_PRICE_ID.length === 0) {
    res.status(503).json({
      error: {
        code: 'STRIPE_NOT_CONFIGURED',
        message:
          'การชำระเงินยังไม่พร้อมใช้งาน Tina กำลังตั้งค่าระบบ ลองอีกครั้งภายหลังนะคะ',
      },
    });
    return;
  }

  try {
    const result = await createCheckoutSession(user);
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'billing.checkout.created',
        db_user_id: user.id,
        session_id: result.session_id,
        customer_id: result.customer_id,
      })
    );
    res.status(201).json({
      url: result.url,
      session_id: result.session_id,
    });
  } catch (err) {
    const isStripeErr = err instanceof StripeServiceError;
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'billing.checkout.failed',
        db_user_id: user.id,
        is_stripe_error: isStripeErr,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res.status(502).json({
      error: {
        code: 'STRIPE_ERROR',
        message: 'ไม่สามารถเริ่ม checkout ได้ ลองอีกครั้งนะคะ',
      },
    });
  }
});

router.post('/cancel', requireAuth, async (req: Request, res: Response) => {
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

  try {
    const subscription = await cancelSubscriptionAtPeriodEnd(user);
    if (subscription === null) {
      res.status(404).json({
        error: {
          code: 'NO_SUBSCRIPTION',
          message: 'No subscription to cancel',
        },
      });
      return;
    }
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'billing.cancel.scheduled',
        db_user_id: user.id,
        provider_subscription_id: subscription.provider_subscription_id,
        cancel_at_period_end: subscription.cancel_at_period_end,
      })
    );
    res.status(200).json({
      subscription: {
        provider: subscription.provider,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at,
      },
    });
  } catch (err) {
    const isStripeErr = err instanceof StripeServiceError;
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'billing.cancel.failed',
        db_user_id: user.id,
        is_stripe_error: isStripeErr,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res.status(502).json({
      error: {
        code: 'STRIPE_ERROR',
        message: 'ไม่สามารถยกเลิกได้ ลองอีกครั้งนะคะ',
      },
    });
  }
});

export default router;
