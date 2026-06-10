import { messagingApi } from '@line/bot-sdk';
import { env } from '../config/env.js';

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
});

export const lineBlobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
});

export const lineSignatureConfig = {
  channelSecret: env.LINE_CHANNEL_SECRET,
};

export const fetchMessageContentAsBase64 = async (
  messageId: string,
  mimeType: string = 'image/jpeg'
): Promise<{ base64: string; mimeType: string }> => {
  const stream = await lineBlobClient.getMessageContent(messageId);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buf = Buffer.concat(chunks);
  return { base64: buf.toString('base64'), mimeType };
};

export const showLoadingAnimation = async (
  lineUserId: string,
  loadingSeconds: number = 20
): Promise<void> => {
  try {
    await lineClient.showLoadingAnimation({
      chatId: lineUserId,
      loadingSeconds,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'line.loading_animation.failed',
        line_user_id: lineUserId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
};
