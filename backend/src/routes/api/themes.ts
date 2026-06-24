import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { userRepository } from '../../repositories/users.js';
import { userThemesRepository } from '../../repositories/user_themes.js';
import {
  buildPublicCatalog,
  DEFAULT_THEME_SLUG,
} from '../../services/themes.js';
import {
  activateTheme,
  purchaseTheme,
  ThemePurchaseError,
} from '../../services/theme_purchase.js';

const router = Router();

const slugBodySchema = z.object({
  slug: z.string().min(1).max(40),
});

const resolveActive = (storedSlug: string | null): string => {
  return storedSlug === null ? DEFAULT_THEME_SLUG : storedSlug;
};

const mapErrorStatus = (code: ThemePurchaseError['code']): number => {
  switch (code) {
    case 'INSUFFICIENT_CREDIT':
      return 402;
    case 'USER_NOT_FOUND':
      return 404;
    case 'NOT_OWNED':
      return 403;
    case 'ALREADY_OWNED':
      return 409;
    case 'PRICE_NOT_CONFIGURED':
      return 503;
    case 'INVALID_SLUG':
    case 'NOT_FOR_SALE':
      return 400;
    default:
      return 400;
  }
};

router.get('/', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const user = userRepository.findById(session.uid);
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const catalog = buildPublicCatalog();
  const owned = new Set(
    userThemesRepository.listByUser(user.id).map((r) => r.theme_slug)
  );
  const active = resolveActive(user.active_theme_slug);

  const themes = catalog.map((t) => ({
    slug: t.slug,
    name_en: t.name_en,
    name_th: t.name_th,
    description_th: t.description_th,
    is_default: t.is_default,
    price_credit: t.price_credit,
    for_sale: t.for_sale,
    owned: t.is_default ? true : owned.has(t.slug),
    is_active: t.slug === active,
  }));

  res.status(200).json({
    active_theme_slug: active,
    credit_balance_satang: user.credit_balance_satang,
    themes,
  });
});

router.post('/purchase', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const user = userRepository.findById(session.uid);
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }
  if (user.is_blocked) {
    res.status(403).json({
      error: { code: 'BLOCKED', message: 'Account is blocked' },
    });
    return;
  }

  const parse = slugBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'slug is required' },
    });
    return;
  }

  try {
    const result = purchaseTheme(user.id, parse.data.slug);
    res.status(200).json({
      theme_slug: result.user_theme.theme_slug,
      credit_spent_satang: result.credit_spent_satang,
      credit_balance_satang: result.user.credit_balance_satang,
      active_theme_slug: resolveActive(result.user.active_theme_slug),
    });
  } catch (err) {
    if (err instanceof ThemePurchaseError) {
      res.status(mapErrorStatus(err.code)).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'themes.purchase.failed',
        db_user_id: user.id,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' },
    });
  }
});

router.post('/activate', requireAuth, (req: Request, res: Response) => {
  const session = req.session;
  if (!session) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
    return;
  }
  const user = userRepository.findById(session.uid);
  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  const parse = slugBodySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'slug is required' },
    });
    return;
  }

  try {
    const updated = activateTheme(user.id, parse.data.slug);
    res.status(200).json({
      active_theme_slug: resolveActive(updated.active_theme_slug),
    });
  } catch (err) {
    if (err instanceof ThemePurchaseError) {
      res.status(mapErrorStatus(err.code)).json({
        error: { code: err.code, message: err.message },
      });
      return;
    }
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'themes.activate.failed',
        db_user_id: user.id,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal error' },
    });
  }
});

export default router;
