import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  requireAdmin,
  requireSuperadmin,
} from '../../../middleware/admin_auth.js';
import { manualPaymentsRepository } from '../../../repositories/manual_payments.js';
import { userRepository } from '../../../repositories/users.js';
import {
  approveManualPayment,
  rejectManualPayment,
  revokeApprovedManualPayment,
  ManualPaymentError,
} from '../../../services/manual_payment.js';
import { readSlipBuffer, SlipStorageError } from '../../../services/slip_storage.js';
import type { ManualPaymentStatus } from '../../../domain/types.js';

const router = Router();

const enrichWithUserSummary = (payments: Array<{ user_id: number }>) => {
  const userIds = Array.from(new Set(payments.map((p) => p.user_id)));
  const userMap = new Map<
    number,
    { id: number; display_name: string | null; abuse_warning_count: number; is_blocked: boolean }
  >();
  for (const id of userIds) {
    const u = userRepository.findById(id);
    if (u !== undefined) {
      userMap.set(id, {
        id: u.id,
        display_name: u.display_name,
        abuse_warning_count: u.abuse_warning_count,
        is_blocked: u.is_blocked,
      });
    }
  }
  return userMap;
};

router.get('/pending', requireAdmin, (req: Request, res: Response) => {
  const limit = Math.min(
    Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50),
    200
  );
  const offset = Math.max(
    0,
    Number.parseInt(String(req.query.offset ?? '0'), 10) || 0
  );
  const payments = manualPaymentsRepository.listPending(limit, offset);
  const userMap = enrichWithUserSummary(payments);
  res.status(200).json({
    payments: payments.map((p) => ({
      ...p,
      user: userMap.get(p.user_id) ?? null,
    })),
    pagination: { limit, offset },
  });
});

const VALID_HISTORY_STATUSES: ReadonlyArray<ManualPaymentStatus> = [
  'approved',
  'rejected',
  'revoked',
];

router.get('/history', requireAdmin, (req: Request, res: Response) => {
  const limit = Math.min(
    Math.max(1, Number.parseInt(String(req.query.limit ?? '50'), 10) || 50),
    200
  );
  const offset = Math.max(
    0,
    Number.parseInt(String(req.query.offset ?? '0'), 10) || 0
  );
  const rawStatus = String(req.query.status ?? '');
  const status =
    VALID_HISTORY_STATUSES.includes(rawStatus as ManualPaymentStatus)
      ? (rawStatus as ManualPaymentStatus)
      : '';
  const userIdRaw = req.query.user_id;
  const userId =
    typeof userIdRaw === 'string' && userIdRaw.length > 0
      ? Number(userIdRaw)
      : null;
  const payments = manualPaymentsRepository.listHistory({
    userId: Number.isInteger(userId) ? userId : null,
    status,
    limit,
    offset,
  });
  const userMap = enrichWithUserSummary(payments);
  res.status(200).json({
    payments: payments.map((p) => ({
      ...p,
      user: userMap.get(p.user_id) ?? null,
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
  const payment = manualPaymentsRepository.findById(id);
  if (payment === undefined) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Payment not found' } });
    return;
  }
  const user = userRepository.findById(payment.user_id);
  res.status(200).json({
    payment,
    user:
      user !== undefined
        ? {
            id: user.id,
            display_name: user.display_name,
            line_user_id: user.line_user_id,
            abuse_warning_count: user.abuse_warning_count,
            is_blocked: user.is_blocked,
            credit_balance_satang: user.credit_balance_satang,
          }
        : null,
  });
});

router.get('/:id/slip', requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
    return;
  }
  const payment = manualPaymentsRepository.findById(id);
  if (
    payment === undefined ||
    payment.slip_file_path === null ||
    payment.slip_mime_type === null
  ) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Slip not found' } });
    return;
  }
  try {
    const buffer = await readSlipBuffer(payment.slip_file_path);
    res.setHeader('Content-Type', payment.slip_mime_type);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(buffer);
  } catch (err) {
    const isStorageErr = err instanceof SlipStorageError;
    res.status(isStorageErr && err.code === 'NOT_FOUND' ? 404 : 500).json({
      error: {
        code: isStorageErr ? err.code : 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Internal error',
      },
    });
  }
});

const approveSchema = z.object({
  actual_amount_satang: z.number().int().positive(),
  admin_notes: z.string().nullable().optional(),
  flag_user_as_abuse: z.boolean().optional(),
  abuse_reason: z.string().nullable().optional(),
});

router.post('/:id/approve', requireAdmin, (req: Request, res: Response) => {
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
  const parse = approveSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Invalid body' },
    });
    return;
  }

  try {
    const result = approveManualPayment({
      payment_id: id,
      admin_id: admin.aid,
      admin_role: admin.role,
      actual_amount_satang: parse.data.actual_amount_satang,
      admin_notes: parse.data.admin_notes ?? null,
      flag_user_as_abuse: parse.data.flag_user_as_abuse ?? false,
      abuse_reason: parse.data.abuse_reason ?? null,
    });
    res.status(200).json({
      payment: result.payment,
      credit_granted_satang: result.credit_granted_satang,
      user_credit_balance_satang: result.user.credit_balance_satang,
    });
  } catch (err) {
    if (err instanceof ManualPaymentError) {
      const httpStatus =
        err.code === 'PAYMENT_NOT_FOUND'
          ? 404
          : err.code === 'HIGH_VALUE_NEEDS_SUPERADMIN'
            ? 403
            : err.code === 'AMOUNT_OUT_OF_RANGE'
              ? 400
              : 409;
      res.status(httpStatus).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'admin.payments.approve.failed',
        payment_id: id,
        admin_id: admin.aid,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
});

const rejectSchema = z.object({
  rejection_reason: z.string().min(1),
  admin_notes: z.string().nullable().optional(),
  flag_user_as_abuse: z.boolean().optional(),
  abuse_reason: z.string().nullable().optional(),
});

router.post('/:id/reject', requireAdmin, (req: Request, res: Response) => {
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
  const parse = rejectSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'rejection_reason required' },
    });
    return;
  }

  try {
    const result = rejectManualPayment({
      payment_id: id,
      admin_id: admin.aid,
      rejection_reason: parse.data.rejection_reason,
      admin_notes: parse.data.admin_notes ?? null,
      flag_user_as_abuse: parse.data.flag_user_as_abuse ?? false,
      abuse_reason: parse.data.abuse_reason ?? null,
    });
    res.status(200).json({ payment: result.payment });
  } catch (err) {
    if (err instanceof ManualPaymentError) {
      const httpStatus = err.code === 'PAYMENT_NOT_FOUND' ? 404 : 409;
      res
        .status(httpStatus)
        .json({ error: { code: err.code, message: err.message } });
      return;
    }
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'admin.payments.reject.failed',
        payment_id: id,
        admin_id: admin.aid,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
});

const revokeSchema = z.object({
  revoke_reason: z.string().min(1),
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
    if (!Number.isInteger(id) || id <= 0) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid id' } });
      return;
    }
    const parse = revokeSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'revoke_reason required' },
      });
      return;
    }

    try {
      const result = revokeApprovedManualPayment({
        payment_id: id,
        admin_id: admin.aid,
        revoke_reason: parse.data.revoke_reason,
      });
      res.status(200).json({
        payment: result.payment,
        credit_deducted_satang: result.credit_deducted_satang,
        balance_went_to_zero: result.balance_went_to_zero,
        user_credit_balance_satang: result.user.credit_balance_satang,
      });
    } catch (err) {
      if (err instanceof ManualPaymentError) {
        const httpStatus = err.code === 'PAYMENT_NOT_FOUND' ? 404 : 409;
        res
          .status(httpStatus)
          .json({ error: { code: err.code, message: err.message } });
        return;
      }
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'admin.payments.revoke.failed',
          payment_id: id,
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

export default router;
