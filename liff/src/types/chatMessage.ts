export type ChatMessageRole = 'user' | 'assistant';

export type ChatMessage = {
  id: number;
  user_id: number;
  role: ChatMessageRole;
  content: string;
  date: string;
  refused: boolean;
  created_at: string;
};

export type ChatQuota = {
  questions_today: number;
  limit: number;
  remaining: number;
};
