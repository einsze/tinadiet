import type { User } from '../types/user.js';

export const isPremium = (user: User, now: Date = new Date()): boolean => {
  if (user.plan !== 'premium') return false;
  if (user.premium_expires_at === null) return false;
  return new Date(user.premium_expires_at).getTime() > now.getTime();
};
