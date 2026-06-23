import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AdminRole } from '../domain/types.js';

const ALGORITHM = 'HS256';
const EXPIRES_IN = '8h';
const AUDIENCE = 'admin';

export type AdminSessionPayload = {
  aid: number;
  email: string;
  role: AdminRole;
};

export type AdminSessionPayloadVerified = AdminSessionPayload & {
  iat: number;
  exp: number;
};

const requireSecret = (): string => {
  if (env.ADMIN_JWT_SECRET.length === 0) {
    throw new Error(
      'ADMIN_JWT_SECRET (or fallback SESSION_JWT_SECRET) must be set for admin auth'
    );
  }
  return env.ADMIN_JWT_SECRET;
};

export const issueAdminJwt = (payload: AdminSessionPayload): string =>
  jwt.sign(payload, requireSecret(), {
    algorithm: ALGORITHM,
    expiresIn: EXPIRES_IN,
    audience: AUDIENCE,
  });

export const verifyAdminJwt = (token: string): AdminSessionPayloadVerified => {
  const decoded = jwt.verify(token, requireSecret(), {
    algorithms: [ALGORITHM],
    audience: AUDIENCE,
  });
  if (typeof decoded === 'string') {
    throw new Error('Unexpected string-form admin JWT payload');
  }
  const { aid, email, role, iat, exp } = decoded as Record<string, unknown>;
  if (
    typeof aid !== 'number' ||
    typeof email !== 'string' ||
    (role !== 'superadmin' && role !== 'operator') ||
    typeof iat !== 'number' ||
    typeof exp !== 'number'
  ) {
    throw new Error('Invalid admin session payload shape');
  }
  return { aid, email, role, iat, exp };
};
