import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  requireAdmin,
  requireSuperadmin,
} from '../../../middleware/admin_auth.js';
import { userRepository } from '../../../repositories/users.js';
import { manualPaymentsRepository } from '../../../repositories/manual_payments.js';
import { creditLedgerRepository } from '../../../repositories/credit_ledger.js';
import { userFlagsRepository } from '../../../repositories/user_flags.js';
import { applyCreditMutation, CreditError } from '../../../services/credit.js';
import { clearAbuseWarnings } from '../../../services/abuse_flag.js';
import { isPremium } from '../../../domain/profile.js';

const router = Router();

router.get('/', requireAdmin, (req: Request, res: Response) => {
  const query = String(req.query.q ?? '').trim();
  const flaggedOnly = String(req.query.flagged ?? '') === '1';
  const limit = Math.min(
    Math.max(1, Number.parseInt(String(req.query.limit ?? '30'), 10) || 30),
    100
  );
  const offset = Math.max(
    0,
    Number.parseInt(String(req.query.offset ?? '0'), 10) || 0
  );

  const users = userRepository.search({ query, flaggedOnly, limit, offset });
  res.status(200).json({
    users: users.map((u) => ({
      id: u.id,
      line_user_id: u.line_user_id,
      display_name: u.display_name,
      plan: u.plan,
      premium_expires_at: u.premium_expires_at,
      credit_balance_satang: u.credit_balance_satang,
      abuse_warning_count: u.abuse_warning_count,
      is_blocked: u.is_blocked,
      is_premium: isPremium(u),
      created_at: u.created_at,
    })),
    pagination: { limit, offset },
  });
});

router.get('/:id', requireAdmin, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
    return;
  }
  const user = userRepository.findById(id);
  if (user === undefined) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  const flags = userFlagsRepository.listByUser(id);
  const recentPayments = manualPaymentsRepository.listByUserRecent(id, 10);
  const recentLedger = creditLedgerRepository.listByUserRecent(id, 20);
  res.status(200).json({
    user: {
      id: user.id,
      line_user_id: user.line_user_id,
      display_name: user.display_name,
      plan: user.plan,
      premium_expires_at: user.premium_expires_at,
      credit_balance_satang: user.credit_balance_satang,
      abuse_warning_count: user.abuse_warning_count,
      is_blocked: user.is_blocked,
      is_premium: isPremium(user),
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
    flags,
    recent_payments: recentPayments,
    recent_ledger: recentLedger,
  });
});

const adjustCreditSchema = z.object({
  delta_satang: z.number().int(),
  reason: z.string().min(1),
});

router.post(
  '/:id/adjust-credit',
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
    if (!Number.isInteger(id) || id <= 0) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
      return;
    }
    const parse = adjustCreditSchema.safeParse(req.body);
    if (!parse.success || parse.data.delta_satang === 0) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'delta_satang (non-zero integer) and reason required',
        },
      });
      return;
    }
    try {
      const result = applyCreditMutation({
        user_id: id,
        amount_satang: parse.data.delta_satang,
        source_type: 'admin_grant',
        source_ref_id: null,
        admin_user_id: admin.aid,
        note: parse.data.reason,
      });
      res.status(200).json({
        ledger_entry: result.ledger_entry,
        user_credit_balance_satang: result.user.credit_balance_satang,
      });
    } catch (err) {
      if (err instanceof CreditError) {
        const httpStatus =
          err.code === 'USER_NOT_FOUND'
            ? 404
            : err.code === 'INSUFFICIENT_BALANCE'
              ? 409
              : 400;
        res
          .status(httpStatus)
          .json({ error: { code: err.code, message: err.message } });
        return;
      }
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'admin.users.adjust-credit.failed',
          user_id: id,
          admin_id: admin.aid,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      res
        .status(500)
        .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
    }
  }
);

const clearWarningsSchema = z.object({
  reason: z.string().min(1),
});

router.post(
  '/:id/clear-warnings',
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
    if (!Number.isInteger(id) || id <= 0) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
      return;
    }
    const parse = clearWarningsSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'reason required' },
      });
      return;
    }
    try {
      const result = clearAbuseWarnings({
        user_id: id,
        cleared_by_admin_id: admin.aid,
        reason: parse.data.reason,
      });
      res.status(200).json({
        cleared_count: result.cleared_count,
        user: {
          id: result.user.id,
          abuse_warning_count: result.user.abuse_warning_count,
          is_blocked: result.user.is_blocked,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      const httpStatus =
        message.includes('not found') ? 404 : 500;
      res
        .status(httpStatus)
        .json({ error: { code: 'INTERNAL_ERROR', message } });
    }
  }
);

router.post(
  '/:id/block',
  requireAdmin,
  requireSuperadmin,
  (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
      return;
    }
    const updated = userRepository.setBlocked(id, true);
    if (updated === undefined) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.status(200).json({ user: { id: updated.id, is_blocked: updated.is_blocked } });
  }
);

router.post(
  '/:id/unblock',
  requireAdmin,
  requireSuperadmin,
  (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
      return;
    }
    const updated = userRepository.setBlocked(id, false);
    if (updated === undefined) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.status(200).json({ user: { id: updated.id, is_blocked: updated.is_blocked } });
  }
);

export default router;
