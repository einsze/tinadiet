import { Router, type Request, type Response } from 'express';
import {
  verifyLiffIdToken,
  LiffTokenVerificationError,
} from '../../line/verify-id-token.js';
import { issueSessionJwt } from '../../auth/session.js';
import { userRepository } from '../../repositories/users.js';

const router = Router();

router.post('/exchange', async (req: Request, res: Response) => {
  const idToken = (req.body as { id_token?: unknown })?.id_token;

  if (typeof idToken !== 'string' || idToken.length === 0) {
    res
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Missing id_token' } });
    return;
  }

  try {
    const payload = await verifyLiffIdToken(idToken);

    const user = userRepository.upsertFromLine({
      line_user_id: payload.sub,
      display_name: payload.name ?? null,
    });

    const session = issueSessionJwt({ uid: user.id, lid: user.line_user_id });

    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'auth.exchange.success',
        db_user_id: user.id,
        line_user_id: payload.sub,
      })
    );

    res.status(200).json({
      session,
      user: {
        id: user.id,
        line_user_id: user.line_user_id,
        display_name: user.display_name,
      },
    });
  } catch (err) {
    const status = err instanceof LiffTokenVerificationError ? err.status : 500;
    const code = err instanceof LiffTokenVerificationError ? 'INVALID_ID_TOKEN' : 'INTERNAL';
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'auth.exchange.failed',
        status,
        error: msg,
      })
    );
    res
      .status(status === 500 ? 500 : 401)
      .json({ error: { code, message: 'LIFF ID token verification failed' } });
  }
});

export default router;
