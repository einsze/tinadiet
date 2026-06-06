import { messagingApi } from '@line/bot-sdk';
import { env } from '../config/env.js';

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
});

export const lineSignatureConfig = {
  channelSecret: env.LINE_CHANNEL_SECRET,
};
