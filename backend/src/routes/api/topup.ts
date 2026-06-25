import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { manualPaymentsRepository } from '../../repositories/manual_payments.js';
import {
  startManualTopup,
  uploadSlipForPayment,
  ManualPaymentError,
} from '../../services/manual_payment.js';
import {
  generatePromptPayQr,
  PromptPayConfigError,
} from '../../services/promptpay_qr.js';
import { systemSettingsRepository } from '../../repositories/system_settings.js';
import { SlipStorageError } from '../../services/slip_storage.js';
import { env } from '../../config/env.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.SLIP_MAX_BYTES },
});

const startBodySchema = z.object({
  amount_thb: z.number().int().positive(),
});

router.post(
  '/manual/start',
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
    if (user.is_blocked) {
      res.status(403).json({
        error: { code: 'USER_BLOCKED', message: 'บัญชีของคุณถูกระงับ' },
      });
      return;
    }

    const parse = startBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'amount_thb (positive integer) required',
        },
      });
      return;
    }
    const amountSatang = parse.data.amount_thb * 100;

    try {
      const { payment } = startManualTopup({
        user,
        requested_amount_satang: amountSatang,
      });
      const qr = await generatePromptPayQr(amountSatang);

      res.status(201).json({
        payment_id: payment.id,
        amount_thb: parse.data.amount_thb,
        amount_satang: amountSatang,
        qr_data_url: qr.data_url,
        promptpay_receiver_id: qr.receiver_id,
        promptpay_receiver_name: qr.receiver_name,
      });
    } catch (err) {
      if (err instanceof ManualPaymentError) {
        const httpStatus =
          err.code === 'USER_BLOCKED'
            ? 403
            : err.code === 'AMOUNT_OUT_OF_RANGE'
              ? 400
              : 409;
        res.status(httpStatus).json({
          error: { code: err.code, message: err.message },
        });
        return;
      }
      if (err instanceof PromptPayConfigError) {
        res.status(503).json({
          error: {
            code: 'PROMPTPAY_NOT_CONFIGURED',
            message:
              'ระบบ PromptPay ยังไม่พร้อมใช้งาน กรุณาลองอีกครั้งภายหลัง',
          },
        });
        return;
      }
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'topup.manual.start.failed',
          db_user_id: user.id,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal error' },
      });
    }
  }
);

router.post(
  '/manual/:paymentId/upload-slip',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('slip')(req, res, (err: unknown) => {
      if (err !== undefined && err !== null) {
        const isMulterErr =
          err instanceof Error && err.constructor.name === 'MulterError';
        const message =
          isMulterErr && err instanceof Error ? err.message : 'Upload failed';
        res
          .status(400)
          .json({ error: { code: 'UPLOAD_ERROR', message } });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const session = req.session;
    if (!session) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
      return;
    }
    const paymentId = Number(req.params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      res
        .status(400)
        .json({ error: { code: 'BAD_REQUEST', message: 'Invalid payment id' } });
      return;
    }
    const file = req.file;
    if (file === undefined) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Missing slip file (field "slip")' },
      });
      return;
    }

    try {
      const result = await uploadSlipForPayment({
        user_id: session.uid,
        payment_id: paymentId,
        buffer: file.buffer,
        mime_type: file.mimetype,
      });
      res.status(200).json({ payment: result.payment });
    } catch (err) {
      if (err instanceof ManualPaymentError) {
        const httpStatus =
          err.code === 'PAYMENT_NOT_FOUND' || err.code === 'WRONG_USER'
            ? 404
            : 409;
        res.status(httpStatus).json({
          error: { code: err.code, message: err.message },
        });
        return;
      }
      if (err instanceof SlipStorageError) {
        const httpStatus = err.code === 'TOO_LARGE' ? 413 : 400;
        res.status(httpStatus).json({
          error: { code: err.code, message: err.message },
        });
        return;
      }
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'topup.manual.upload.failed',
          db_user_id: session.uid,
          payment_id: paymentId,
          error: err instanceof Error ? err.message : String(err),
        })
      );
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Internal error' },
      });
    }
  }
);

router.get('/submissions', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const limit = Math.min(
    Math.max(1, Number.parseInt(String(req.query.limit ?? '10'), 10) || 10),
    50
  );
  const submissions = manualPaymentsRepository.listByUserRecent(
    session.uid,
    limit
  );
  // Don't expose internal admin_notes to users
  const filtered = submissions.map((p) => ({
    id: p.id,
    requested_amount_satang: p.requested_amount_satang,
    actual_amount_satang: p.actual_amount_satang,
    status: p.status,
    rejection_reason: p.rejection_reason,
    credit_granted_satang: p.credit_granted_satang,
    created_at: p.created_at,
    reviewed_at: p.reviewed_at,
  }));
  res.status(200).json({ submissions: filtered });
});

router.get('/config', requireAuth, (_req: Request, res: Response) => {
  // Public top-up presets + min/max for the LIFF tier picker
  const minSatang = systemSettingsRepository.getNumber('topup_min_satang', 5000);
  const maxSatang = systemSettingsRepository.getNumber(
    'topup_max_satang',
    500000
  );
  res.status(200).json({
    presets_thb: [150, 450, 900, 1800],
    min_thb: Math.ceil(minSatang / 100),
    max_thb: Math.floor(maxSatang / 100),
  });
});

export default router;
