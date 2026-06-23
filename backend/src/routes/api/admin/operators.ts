import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  requireAdmin,
  requireSuperadmin,
} from '../../../middleware/admin_auth.js';
import { adminUsersRepository } from '../../../repositories/admin_users.js';
import { hashPassword } from '../../../services/admin_auth.js';

const router = Router();

router.get(
  '/',
  requireAdmin,
  requireSuperadmin,
  (_req: Request, res: Response) => {
    const operators = adminUsersRepository.listAll();
    res.status(200).json({ operators });
  }
);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(1),
  role: z.enum(['superadmin', 'operator']),
});

router.post(
  '/',
  requireAdmin,
  requireSuperadmin,
  async (req: Request, res: Response) => {
    const admin = req.admin;
    if (!admin) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'No admin session' } });
      return;
    }
    const parse = createSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'email, password (min 8), display_name, role required',
        },
      });
      return;
    }

    const existing = adminUsersRepository.findByEmail(parse.data.email);
    if (existing !== undefined) {
      res.status(409).json({
        error: { code: 'EMAIL_TAKEN', message: 'Email already in use' },
      });
      return;
    }

    const passwordHash = await hashPassword(parse.data.password);
    try {
      const created = adminUsersRepository.create({
        email: parse.data.email,
        password_hash: passwordHash,
        display_name: parse.data.display_name,
        role: parse.data.role,
        created_by_admin_id: admin.aid,
      });
      res
        .status(201)
        .json({ admin: adminUsersRepository.toPublic(created) });
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'admin.operators.create.failed',
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

const updateSchema = z.object({
  display_name: z.string().min(1).optional(),
  role: z.enum(['superadmin', 'operator']).optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

router.put(
  '/:id',
  requireAdmin,
  requireSuperadmin,
  async (req: Request, res: Response) => {
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
    const parse = updateSchema.safeParse(req.body);
    if (!parse.success || Object.keys(parse.data).length === 0) {
      res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'No valid fields to update' },
      });
      return;
    }
    const existing = adminUsersRepository.findById(id);
    if (existing === undefined) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Admin not found' } });
      return;
    }

    // Protect: superadmin cannot demote or deactivate themselves
    const isSelf = id === admin.aid;
    if (isSelf) {
      if (parse.data.role !== undefined && parse.data.role !== existing.role) {
        res.status(400).json({
          error: {
            code: 'SELF_DEMOTE',
            message: 'Cannot change your own role',
          },
        });
        return;
      }
      if (parse.data.is_active === false) {
        res.status(400).json({
          error: {
            code: 'SELF_DEACTIVATE',
            message: 'Cannot deactivate your own account',
          },
        });
        return;
      }
    }

    if (
      parse.data.display_name !== undefined ||
      parse.data.role !== undefined ||
      parse.data.is_active !== undefined
    ) {
      adminUsersRepository.updateProfile(id, {
        display_name: parse.data.display_name ?? existing.display_name,
        role: parse.data.role ?? existing.role,
        is_active: parse.data.is_active ?? existing.is_active,
      });
    }

    if (parse.data.password !== undefined) {
      const newHash = await hashPassword(parse.data.password);
      adminUsersRepository.updatePassword(id, newHash);
    }

    const updated = adminUsersRepository.findById(id);
    if (updated === undefined) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Admin not found after update' } });
      return;
    }
    res
      .status(200)
      .json({ admin: adminUsersRepository.toPublic(updated) });
  }
);

router.delete(
  '/:id',
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
    if (id === admin.aid) {
      res.status(400).json({
        error: {
          code: 'SELF_DELETE',
          message: 'Cannot delete your own account',
        },
      });
      return;
    }
    const ok = adminUsersRepository.deleteById(id);
    if (!ok) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Admin not found' } });
      return;
    }
    res.status(200).json({ ok: true });
  }
);

export default router;
