import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { giftsRepository } from '../../repositories/gifts.js';
import {
  createGift,
  cancelGift,
  claimGift,
  parseGiftPayload,
  notifyGiftClaimed,
  notifyGiftCanceled,
  notifyGiftRefused,
  GiftError,
} from '../../services/gifts.js';
import type { GiftPayload } from '../../domain/types.js';

const router = Router();

const premiumPayloadSchema = z.object({
  months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
});
const themePayloadSchema = z.object({
  theme_slug: z.string().min(1).max(40),
});

const createSchema = z.discriminatedUnion('gift_type', [
  z.object({
    gift_type: z.literal('premium'),
    payload: premiumPayloadSchema,
    message: z.string().max(500).nullable().optional(),
  }),
  z.object({
    gift_type: z.literal('theme'),
    payload: themePayloadSchema,
    message: z.string().max(500).nullable().optional(),
  }),
]);

const mapErrorStatus = (code: GiftError['code']): number => {
  switch (code) {
    case 'INSUFFICIENT_CREDIT':
      return 402;
    case 'USER_NOT_FOUND':
    case 'GIFT_NOT_FOUND':
      return 404;
    case 'NOT_OWNER':
    case 'BLOCKED':
    case 'RECIPIENT_BLOCKED':
      return 403;
    case 'PENDING_CAP_REACHED':
      return 429;
    case 'PRICE_NOT_CONFIGURED':
      return 503;
    case 'GIFT_EXPIRED':
      return 410;
    case 'GIFT_NOT_PENDING':
    case 'GIFT_NOT_CLAIMED':
    case 'SELF_CLAIM':
    case 'RECIPIENT_ALREADY_OWNS_THEME':
      return 409;
    case 'INVALID_GIFT_TYPE':
    case 'INVALID_PAYLOAD':
    case 'MESSAGE_TOO_LONG':
    default:
      return 400;
  }
};

const handleError = (
  err: unknown,
  res: Response,
  context: string
): void => {
  if (err instanceof GiftError) {
    res
      .status(mapErrorStatus(err.code))
      .json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(
    JSON.stringify({
      level: 'error',
      msg: `gifts.${context}.failed`,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
};

router.post('/', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid gift body',
        details: parse.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }
  try {
    const result = createGift({
      sender_user_id: session.uid,
      gift_type: parse.data.gift_type,
      payload: parse.data.payload as GiftPayload,
      message: parse.data.message ?? null,
    });
    res.status(201).json({
      gift_id: result.gift.id,
      claim_token: result.gift.claim_token,
      claim_url: result.claim_url,
      claim_expires_at: result.gift.claim_expires_at,
      credit_balance_satang: result.credit_balance_satang,
    });
  } catch (err) {
    handleError(err, res, 'create');
  }
});

router.get('/sent', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
  const gifts = giftsRepository.listSent(session.uid, limit);
  res.status(200).json({
    gifts: gifts.map((g) => ({
      id: g.id,
      claim_token: g.claim_token,
      gift_type: g.gift_type,
      payload: parseGiftPayload(g),
      credit_spent_satang: g.credit_spent_satang,
      status: g.status,
      message: g.message,
      claim_expires_at: g.claim_expires_at,
      claimed_at: g.claimed_at,
      canceled_at: g.canceled_at,
      expired_at: g.expired_at,
      refused_at: g.refused_at,
      refused_reason: g.refused_reason,
      revoked_at: g.revoked_at,
      revoke_reason: g.revoke_reason,
      recipient_user_id: g.recipient_user_id,
      created_at: g.created_at,
    })),
  });
});

router.get('/received', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
  const gifts = giftsRepository.listReceived(session.uid, limit);
  res.status(200).json({
    gifts: gifts.map((g) => {
      const sender = userRepository.findById(g.sender_user_id);
      return {
        id: g.id,
        gift_type: g.gift_type,
        payload: parseGiftPayload(g),
        status: g.status,
        message: g.message,
        sender_display_name: sender?.display_name ?? null,
        claimed_at: g.claimed_at,
        revoked_at: g.revoked_at,
      };
    }),
  });
});

router.get('/claim/:token', (req: Request, res: Response) => {
  const token = req.params.token ?? '';
  if (token.length === 0) {
    res
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Token required' } });
    return;
  }
  const gift = giftsRepository.findByToken(token);
  if (gift === undefined) {
    res.status(404).json({
      error: { code: 'GIFT_NOT_FOUND', message: 'Hadiah tidak ditemukan' },
    });
    return;
  }
  const sender = userRepository.findById(gift.sender_user_id);
  res.status(200).json({
    gift_type: gift.gift_type,
    payload: parseGiftPayload(gift),
    sender_display_name: sender?.display_name ?? null,
    message: gift.message,
    status: gift.status,
    claim_expires_at: gift.claim_expires_at,
    credit_value_satang: gift.credit_spent_satang,
  });
});

router.post(
  '/claim/:token',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session;
    if (!session) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
      return;
    }
    const token = req.params.token ?? '';
    if (token.length === 0) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Token required' } });
      return;
    }
    try {
      const result = claimGift(token, session.uid);
      // Notify sender (async, fire-and-forget)
      void notifyGiftClaimed(result.gift, result.recipient);
      res.status(200).json({
        gift_id: result.gift.id,
        gift_type: result.gift.gift_type,
        payload: parseGiftPayload(result.gift),
        recipient_user: {
          id: result.recipient.id,
          credit_balance_satang: result.recipient.credit_balance_satang,
          premium_expires_at: result.recipient.premium_expires_at,
          active_theme_slug: result.recipient.active_theme_slug,
        },
      });
    } catch (err) {
      if (err instanceof GiftError) {
        // For refused states, async notify sender
        if (
          err.code === 'SELF_CLAIM' ||
          err.code === 'RECIPIENT_BLOCKED' ||
          err.code === 'RECIPIENT_ALREADY_OWNS_THEME'
        ) {
          const gift = giftsRepository.findByToken(token);
          if (gift !== undefined) void notifyGiftRefused(gift);
        }
      }
      handleError(err, res, 'claim');
    }
  }
);

router.post(
  '/:id/cancel',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session;
    if (!session) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
      return;
    }
    try {
      const result = cancelGift(id, session.uid);
      void notifyGiftCanceled(result.gift);
      res.status(200).json({
        gift_id: result.gift.id,
        credit_balance_satang: result.credit_balance_satang,
      });
    } catch (err) {
      handleError(err, res, 'cancel');
    }
  }
);

export default router;
