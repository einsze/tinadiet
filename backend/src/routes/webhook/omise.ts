import { Router, type Request, type Response } from 'express';
import express from 'express';
import {
  parseOmiseWebhookEvent,
  handleOmiseEvent,
  verifyOmiseSignature,
  OmiseServiceError,
} from '../../services/omise.js';

const router = Router();

router.post(
  '/omise',
  express.raw({ type: 'application/json', limit: '512kb' }),
  async (req: Request, res: Response) => {
    if (!Buffer.isBuffer(req.body)) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'webhook.omise.body_not_buffer',
          body_type: typeof req.body,
        })
      );
      res.status(400).json({ error: { code: 'BAD_BODY' } });
      return;
    }
    const rawBody = req.body.toString('utf8');

    const signatureHeader = req.headers['omise-signature'];
    const timestampHeader = req.headers['omise-signature-timestamp'];
    const sig = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;
    const ts = Array.isArray(timestampHeader)
      ? timestampHeader[0]
      : timestampHeader;

    if (!verifyOmiseSignature(rawBody, sig, ts)) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: 'webhook.omise.bad_signature',
          has_sig: typeof sig === 'string' && sig.length > 0,
          has_ts: typeof ts === 'string' && ts.length > 0,
        })
      );
      res.status(400).json({ error: { code: 'BAD_SIGNATURE' } });
      return;
    }

    let event;
    try {
      event = parseOmiseWebhookEvent(rawBody);
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
