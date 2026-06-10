import { api } from '../lib/api.js';
import type { ChatMessage, ChatQuota } from '../types/chatMessage.js';

export type ChatHistoryResponse = {
  messages: ChatMessage[];
  quota: ChatQuota;
};

export type ChatSendResponse = {
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  quota: ChatQuota;
};

export const chatApi = {
  list: (limit?: number) => {
    const path =
      typeof limit === 'number'
        ? `/api/v1/chat/messages?limit=${encodeURIComponent(String(limit))}`
        : '/api/v1/chat/messages';
    return api.get<ChatHistoryResponse>(path);
  },
  send: (content: string) =>
    api.post<ChatSendResponse>('/api/v1/chat/messages', { content }),
};
