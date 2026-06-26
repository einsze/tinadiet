import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  requireAdmin,
  requireSuperadmin,
} from '../../../middleware/admin_auth.js';
import { giftsRepository } from '../../../repositories/gifts.js';
import { userRepository } from '../../../repositories/users.js';
import {
  revokeGift,
  parseGiftPayload,
  notifyGiftRevokedToSender,
  notifyGiftRevokedToRecipient,
  GiftError,
} from '../../../services/gifts.js';
import type { GiftStatus } from '../../../domain/types.js';

const router = Router();

const ALLOWED_STATUSES: GiftStatus[] = [
  'pending',
  'claimed',
  'canceled',
  'expired',
  'refused',
  'revoked',
];

const decorate = (g: ReturnType<typeof giftsRepository.findById>) => {
  if (g === undefined) return null;
  const sender = userRepository.findById(g.sender_user_id);
  const recipient =
    g.recipient_user_id !== null
      ? userRepository.findById(g.recipient_user_id)
      : null;
  return {
    id: g.id,
    claim_token: g.claim_token,
    gift_type: g.gift_type,
    payload: parseGiftPayload(g),
    credit_spent_satang: g.credit_spent_satang,
    message: g.message,
    status: g.status,
    claim_expires_at: g.claim_expires_at,
    claimed_at: g.claimed_at,
    canceled_at: g.canceled_at,
    expired_at: g.expired_at,
    refused_at: g.refused_at,
    refused_reason: g.refused_reason,
    revoked_at: g.revoked_at,
    revoked_by_admin_id: g.revoked_by_admin_id,
    revoke_reason: g.revoke_reason,
    applied_premium_ms_added: g.applied_premium_ms_added,
    applied_theme_slug: g.applied_theme_slug,
    created_at: g.created_at,
    updated_at: g.updated_at,
    sender: sender
      ? {
          id: sender.id,
          display_name: sender.display_name,
          line_user_id: sender.line_user_id,
        }
      : null,
    recipient: recipient
      ? {
          id: recipient.id,
          display_name: recipient.display_name,
          line_user_id: recipient.line_user_id,
        }
      : null,
  };
};

router.get('/', requireAdmin, (req: Request, res: Response) => {
  const statusParam = String(req.query.status ?? '');
  const status: GiftStatus | '' =
    ALLOWED_STATUSES.includes(statusParam as GiftStatus)
      ? (statusParam as GiftStatus)
      : '';
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const q = String(req.query.q ?? '').trim();
  const gifts = giftsRepository.listAdmin({ status, q, limit, offset });
  const total = giftsRepository.countAdmin({ status, q });
  res.status(200).json({
    gifts: gifts.map((g) => decorate(g)).filter(Boolean),
    pagination: { limit, offset, total },
  });
});

router.get('/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
    return;
  }
  const g = giftsRepository.findById(id);
  if (g === undefined) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Gift not found' } });
    return;
  }
  res.status(200).json({ gift: decorate(g) });
});

const revokeSchema = z.object({
  reason: z.string().min(3).max(500),
});

router.post(
  '/:id/revoke',
  requireAdmin,
  requireSuperadmin,
  (req: Request, res: Response) => {
    const admin = req.admin;
    if (!admin) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'No admin session' } });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
      return;
    }
    const parse = revokeSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'reason is required (3-500 chars)',
        },
      });
      return;
    }
    try {
      const result = revokeGift(id, admin.aid, parse.data.reason);
      void notifyGiftRevokedToSender(result.gift);
      void notifyGiftRevokedToRecipient(result.gift);
      res.status(200).json({
        gift_id: result.gift.id,
        sender_new_balance_satang: result.sender_new_balance_satang,
      });
    } catch (err) {
      if (err instanceof GiftError) {
        const status =
          err.code === 'GIFT_NOT_FOUND'
            ? 404
            : err.code === 'GIFT_NOT_CLAIMED'
              ? 409
              : 400;
        res
          .status(status)
          .json({ error: { code: err.code, message: err.message } });
        return;
      }
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'admin.gifts.revoke.failed',
          error: err instanceof Error ? err.message : String(err),
        })
      );
      res
        .status(500)
        .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
    }
  }
);

export default router;
