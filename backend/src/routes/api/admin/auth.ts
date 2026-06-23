import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../../middleware/admin_auth.js';
import { adminUsersRepository } from '../../../repositories/admin_users.js';
import {
  loginAdmin,
  changeAdminPassword,
  AdminAuthError,
} from '../../../services/admin_auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'email and password required' },
    });
    return;
  }

  try {
    const result = await loginAdmin(parse.data.email, parse.data.password);
    res.status(200).json({
      token: result.token,
      admin: result.admin,
    });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      const httpStatus = err.code === 'INACTIVE' ? 403 : 401;
      res
        .status(httpStatus)
        .json({ error: { code: err.code, message: err.message } });
      return;
    }
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'admin.login.failed',
        email: parse.data.email,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
});

router.get('/me', requireAdmin, (req: Request, res: Response) => {
  const admin = req.admin;
  if (!admin) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'No admin session' } });
    return;
  }
  const dbAdmin = adminUsersRepository.findById(admin.aid);
  if (dbAdmin === undefined) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Admin not found' } });
    return;
  }
  res.status(200).json({ admin: adminUsersRepository.toPublic(dbAdmin) });
});

const changePwSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

router.post(
  '/change-password',
  requireAdmin,
  async (req: Request, res: Response) => {
    const admin = req.admin;
    if (!admin) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'No admin session' } });
      return;
    }
    const parse = changePwSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'current_password and new_password (min 8 chars) required',
        },
      });
      return;
    }
    const dbAdmin = adminUsersRepository.findById(admin.aid);
    if (dbAdmin === undefined) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Admin not found' } });
      return;
    }
    try {
      await changeAdminPassword(
        dbAdmin,
        parse.data.current_password,
        parse.data.new_password
      );
      res.status(200).json({ ok: true });
    } catch (err) {
      if (err instanceof AdminAuthError) {
        res
          .status(400)
          .json({ error: { code: err.code, message: err.message } });
        return;
      }
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'admin.change-password.failed',
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
