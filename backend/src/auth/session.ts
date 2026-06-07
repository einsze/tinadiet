import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ALGORITHM = 'HS256';
const EXPIRES_IN = '7d';

export type SessionPayload = {
  uid: number;
  lid: string;
};

export type SessionPayloadVerified = SessionPayload & {
  iat: number;
  exp: number;
};

export const issueSessionJwt = (payload: SessionPayload): string =>
  jwt.sign(payload, env.SESSION_JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: EXPIRES_IN,
  });

export const verifySessionJwt = (token: string): SessionPayloadVerified => {
  const decoded = jwt.verify(token, env.SESSION_JWT_SECRET, {
    algorithms: [ALGORITHM],
  });
  if (typeof decoded === 'string') {
    throw new Error('Unexpected string-form JWT payload');
  }
  const { uid, lid, iat, exp } = decoded as Record<string, unknown>;
  if (
    typeof uid !== 'number' ||
    typeof lid !== 'string' ||
    typeof iat !== 'number' ||
    typeof exp !== 'number'
  ) {
    throw new Error('Invalid session payload shape');
  }
  return { uid, lid, iat, exp };
};
