import { Router, type Request, type Response } from 'express';
import express from 'express';
import {
  parseOmiseWebhookEvent,
  handleOmiseEvent,
  verifyOmiseBasicAuth,
  OmiseServiceError,
} from '../../services/omise.js';

const router = Router();

router.post(
  '/omise',
  express.json({ limit: '512kb' }),
  async (req: Request, res: Response) => {
    const auth = req.headers['authorization'];
    if (!verifyOmiseBasicAuth(typeof auth === 'string' ? auth : undefined)) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: 'webhook.omise.bad_auth',
          has_header: typeof auth === 'string',
        })
      );
      res
        .status(401)
        .set('WWW-Authenticate', 'Basic realm="omise-webhook"')
        .json({ error: { code: 'UNAUTHORIZED' } });
      return;
    }

    let event;
    try {
      event = parseOmiseWebhookEvent(req.body);
    } catch (err) {
      const isOmiseErr = err instanceof OmiseServiceError;
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: 'webhook.omise.parse_failed',
          is_omise_error: isOmiseErr,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      res.status(400).json({ error: { code: 'BAD_BODY' } });
      return;
    }

    // ACK immediately — Omise retries on non-2xx, so always 200 after auth+parse OK
    res.status(200).json({ received: true });

    try {
      const result = await handleOmiseEvent(event);
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'webhook.omise.handled',
          event_id: event.id,
          event_type: event.key,
          handled: result.handled,
          charge_id: result.charge_id,
          db_user_id: result.user_id,
          payment_status: result.payment_status,
          plan: result.plan,
          premium_expires_at: result.premium_expires_at,
        })
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'webhook.omise.handle_failed',
          event_id: event.id,
          event_type: event.key,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
);

export default router;
