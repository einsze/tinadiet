import { env } from '../config/env.js';

const VERIFY_ENDPOINT = 'https://api.line.me/oauth2/v2.1/verify';

export type LiffIdTokenPayload = {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  amr: string[];
  name?: string;
  picture?: string;
  email?: string;
};

export class LiffTokenVerificationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = 'LiffTokenVerificationError';
  }
}

export const verifyLiffIdToken = async (
  idToken: string
): Promise<LiffIdTokenPayload> => {
  const body = new URLSearchParams({
    id_token: idToken,
    client_id: env.LINE_LOGIN_CHANNEL_ID,
  });

  const res = await fetch(VERIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new LiffTokenVerificationError(
      `LINE verify endpoint returned ${res.status}`,
      res.status,
      text
    );
  }

  return JSON.parse(text) as LiffIdTokenPayload;
};
