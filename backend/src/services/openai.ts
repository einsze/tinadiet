import OpenAI from 'openai';
import { env } from '../config/env.js';

let _client: OpenAI | null = null;

export const openai = (): OpenAI => {
  if (_client !== null) return _client;
  if (env.OPENAI_API_KEY.length === 0) {
    throw new Error(
      'OPENAI_API_KEY is not set in env — cannot create OpenAI client'
    );
  }
  _client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: env.OPENAI_TIMEOUT_MS,
  });
  return _client;
};
