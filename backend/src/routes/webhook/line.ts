import { Router, type Request, type Response } from 'express';
import {
  middleware as lineMiddleware,
  type WebhookEvent,
  type MessageEvent,
  type TextEventMessage,
} from '@line/bot-sdk';
import { lineClient, lineSignatureConfig } from '../../line/client.js';
import { userRepository } from '../../repositories/users.js';

const router = Router();

const isTextMessageEvent = (
  event: WebhookEvent
): event is MessageEvent & { message: TextEventMessage } =>
  event.type === 'message' && event.message.type === 'text';

const handleEvent = async (event: WebhookEvent): Promise<void> => {
  if (!isTextMessageEvent(event)) {
    return;
  }

  const lineUserId = event.source.userId;
  if (!lineUserId) {
    return;
  }

  const user = userRepository.upsertFromLine({ line_user_id: lineUserId });

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'webhook.message.text',
      db_user_id: user.id,
      line_user_id: lineUserId,
      text_length: event.message.text.length,
    })
  );

  const replyText = `User #${user.id}\nEcho: ${event.message.text}`;

  await lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: 'text', text: replyText }],
  });
};

router.post(
  '/line',
  lineMiddleware(lineSignatureConfig),
  async (req: Request, res: Response) => {
    const events: WebhookEvent[] = req.body.events ?? [];

    res.status(200).json({ ok: true });

    await Promise.all(
      events.map((event) =>
        handleEvent(event).catch((err: unknown) => {
          console.error(
            JSON.stringify({
              level: 'error',
              msg: 'webhook.handler.error',
              event_type: event.type,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        })
      )
    );
  }
);

export default router;
