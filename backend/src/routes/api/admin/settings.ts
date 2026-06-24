import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  requireAdmin,
  requireSuperadmin,
} from '../../../middleware/admin_auth.js';
import { systemSettingsRepository } from '../../../repositories/system_settings.js';
import type { SystemSettingKey } from '../../../domain/types.js';

const router = Router();

const ALLOWED_KEYS: ReadonlyArray<SystemSettingKey> = [
  'promptpay_id',
  'promptpay_id_type',
  'promptpay_receiver_name',
  'price_1mo_credit',
  'price_3mo_credit',
  'price_6mo_credit',
  'price_12mo_credit',
  'high_value_threshold_satang',
  'topup_min_satang',
  'topup_max_satang',
  'price_theme_sakura_credit',
  'price_theme_ocean_credit',
  'price_theme_forest_credit',
  'price_theme_sunset_credit',
  'price_theme_midnight_credit',
];

router.get('/', requireAdmin, (_req: Request, res: Response) => {
  const settings = systemSettingsRepository.all();
  res.status(200).json({ settings });
});

const updateSchema = z.object({
  updates: z.record(z.string(), z.string()),
});

router.put(
  '/',
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
    const parse = updateSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'updates (object) required' },
      });
      return;
    }
    const invalidKeys = Object.keys(parse.data.updates).filter(
      (k) => !ALLOWED_KEYS.includes(k as SystemSettingKey)
    );
    if (invalidKeys.length > 0) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: `Invalid setting keys: ${invalidKeys.join(', ')}`,
        },
      });
      return;
    }
    const updated: Record<string, string> = {};
    for (const [key, value] of Object.entries(parse.data.updates)) {
      const row = systemSettingsRepository.set(
        key as SystemSettingKey,
        value,
        admin.aid
      );
      updated[key] = row.value;
    }
    res.status(200).json({ updated });
  }
);

export default router;
