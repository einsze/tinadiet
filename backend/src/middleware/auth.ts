import type { Request, Response, NextFunction } from 'express';
import {
  verifySessionJwt,
  type SessionPayloadVerified,
} from '../auth/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    session?: SessionPayloadVerified;
  }
}

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } });
    return;
  }
  const token = auth.slice('Bearer '.length).trim();
  try {
    req.session = verifySessionJwt(token);
    next();
  } catch (_err) {
    res
      .status(401)
      .json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired session' } });
  }
};
