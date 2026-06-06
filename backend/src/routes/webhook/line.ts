import { Router, type Request, type Response } from 'express';
import {
  middleware as lineMiddleware,
  type WebhookEvent,
  type MessageEvent,
  type TextEventMessage,
} from '@line/bot-sdk';
import { lineClient, lineSignatureConfig } from '../../line/client.js';

const router = Router();

const isTextMessageEvent = (
  event: WebhookEvent
): event is MessageEvent & { message: TextEventMessage } =>
  event.type === 'message' && event.message.type === 'text';

const handleEvent = async (event: WebhookEvent): Promise<void> => {
  if (!isTextMessageEvent(event)) {
    return;
  }

  const userText = event.message.text;
  const replyToken = event.replyToken;

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: 'text',
        text: `Echo: ${userText}`,
      },
    ],
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
