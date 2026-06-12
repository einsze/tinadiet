import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { subscriptionsRepository } from '../../repositories/subscriptions.js';
import { paymentsRepository } from '../../repositories/payments.js';
import {
  createCheckoutSession,
  cancelSubscriptionAtPeriodEnd,
  StripeServiceError,
} from '../../services/stripe.js';
import {
  createOmiseCharge,
  syncChargeFromOmise,
  isOmiseConfigured,
  OmiseServiceError,
} from '../../services/omise.js';
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
  const latestPayment = paymentsRepository.findLatestSuccessfulByUser(user.id);
  const stripeConfigured =
    env.STRIPE_SECRET_KEY.length > 0 && env.STRIPE_PRICE_ID.length > 0;
  const omiseConfigured = isOmiseConfigured();

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
    latest_payment:
      latestPayment !== undefined
        ? {
            provider: latestPayment.provider,
            method: latestPayment.method,
            status: latestPayment.status,
            amount_satang: latestPayment.amount_satang,
            currency: latestPayment.currency,
            completed_at: latestPayment.completed_at,
            grant_ends_at: latestPayment.grant_ends_at,
          }
        : null,
    pricing: {
      currency: 'THB',
      amount: env.PAYMENT_AMOUNT_THB,
      grant_days: env.PAYMENT_GRANT_DAYS,
      model: 'manual_renew',
    },
    stripe_configured: stripeConfigured,
    omise_configured: omiseConfigured,
  });
});

// ----- Omise (manual renew via PromptPay / TrueMoney) -----

const createChargeBodySchema = z.object({
  method: z.enum(['promptpay', 'truemoney']),
});

router.post(
  '/omise/charge',
  requireAuth,
  async (req: Request, res: Response) => {
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

    if (!isOmiseConfigured()) {
      res.status(503).json({
        error: {
          code: 'OMISE_NOT_CONFIGURED',
          message:
            'การชำระเงินยังไม่พร้อมใช้งาน Tina กำลังตั้งค่าระบบ ลองอีกครั้งภายหลังนะคะ',
        },
      });
      return;
    }

    const parse = createChargeBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'method must be promptpay or truemoney',
        },
      });
      return;
    }

    try {
      const result = await createOmiseCharge(user, parse.data.method);
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'billing.omise.charge.created',
          db_user_id: user.id,
          charge_id: result.charge_id,
          method: result.method,
          amount_satang: result.amount_satang,
        })
      );
      res.status(201).json({
        charge_id: result.charge_id,
        status: result.status,
        method: result.method,
        amount_satang: result.amount_satang,
        qr_image_uri: result.qr_image_uri,
        authorize_uri: result.authorize_uri,
        expires_at: result.expires_at,
      });
    } catch (err) {
      const isOmiseErr = err instanceof OmiseServiceError;
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'billing.omise.charge.failed',
          db_user_id: user.id,
          is_omise_error: isOmiseErr,
          http_status: isOmiseErr ? err.httpStatus : undefined,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      res.status(502).json({
        error: {
          code: 'OMISE_ERROR',
          message: 'ไม่สามารถสร้างรายการชำระเงินได้ ลองอีกครั้งนะคะ',
        },
      });
    }
  }
);

router.get(
  '/omise/charge/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session;
    if (!session) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
      return;
    }
    const chargeId = req.params.id;
    if (typeof chargeId !== 'string' || chargeId.length === 0) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Missing charge id' } });
      return;
    }

    const payment = paymentsRepository.findByProviderChargeId(
      'omise',
      chargeId
    );
    if (payment === undefined) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } });
      return;
    }
    if (payment.user_id !== session.uid) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } });
      return;
    }

    // If still pending and Omise is configured, sync with Omise to catch
    // missed webhooks (e.g. webhook delivery delayed)
    let current = payment;
    if (payment.status === 'pending' && isOmiseConfigured()) {
      try {
        const synced = await syncChargeFromOmise(chargeId);
        if (synced !== undefined) current = synced;
      } catch (err) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            msg: 'billing.omise.charge.sync_failed',
            charge_id: chargeId,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      }
    }

    res.status(200).json({
      charge_id: current.provider_charge_id,
      status: current.status,
      method: current.method,
      amount_satang: current.amount_satang,
      qr_image_uri: current.qr_image_uri,
      authorize_uri: current.authorize_uri,
      expires_at: current.expires_at,
      completed_at: current.completed_at,
      grant_ends_at: current.grant_ends_at,
    });
  }
);

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
