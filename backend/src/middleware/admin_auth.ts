import type { Request, Response, NextFunction } from 'express';
import {
  verifyAdminJwt,
  type AdminSessionPayloadVerified,
} from '../auth/admin_session.js';
import { adminUsersRepository } from '../repositories/admin_users.js';

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminSessionPayloadVerified;
  }
}

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
    });
    return;
  }
  const token = auth.slice('Bearer '.length).trim();
  let payload: AdminSessionPayloadVerified;
  try {
    payload = verifyAdminJwt(token);
  } catch (_err) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired admin session' },
    });
    return;
  }

  // Verify admin still active in DB on every request
  const dbAdmin = adminUsersRepository.findById(payload.aid);
  if (dbAdmin === undefined || !dbAdmin.is_active) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Admin account inactive or removed' },
    });
    return;
  }

  // Use latest DB role (in case role changed since token was issued)
  req.admin = { ...payload, role: dbAdmin.role };
  next();
};

export const requireSuperadmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.admin === undefined) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
    return;
  }
  if (req.admin.role !== 'superadmin') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Superadmin privileges required',
      },
    });
    return;
  }
  next();
};
