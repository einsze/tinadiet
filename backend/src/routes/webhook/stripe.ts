import { Router, type Request, type Response } from 'express';
import express from 'express';
import {
  parseStripeWebhookEvent,
  handleStripeEvent,
  StripeServiceError,
} from '../../services/stripe.js';

const router = Router();

router.post(
  '/stripe',
  express.raw({ type: 'application/json', limit: '512kb' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || signature.length === 0) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: 'webhook.stripe.missing_signature',
        })
      );
      res.status(400).json({ error: { code: 'BAD_SIGNATURE' } });
      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'webhook.stripe.body_not_buffer',
          body_type: typeof req.body,
        })
      );
      res.status(400).json({ error: { code: 'BAD_BODY' } });
      return;
    }

    let event;
    try {
      event = parseStripeWebhookEvent(req.body, signature);
    } catch (err) {
      const isStripeErr = err instanceof StripeServiceError;
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: 'webhook.stripe.signature_invalid',
          is_stripe_error: isStripeErr,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      res.status(400).json({ error: { code: 'BAD_SIGNATURE' } });
      return;
    }

    res.status(200).json({ received: true });

    try {
      const result = await handleStripeEvent(event);
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'webhook.stripe.handled',
          event_id: event.id,
          event_type: event.type,
          handled: result.handled,
          db_user_id: result.user_id,
          plan: result.plan,
          premium_expires_at: result.premium_expires_at,
        })
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'webhook.stripe.handle_failed',
          event_id: event.id,
          event_type: event.type,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
);

export default router;
