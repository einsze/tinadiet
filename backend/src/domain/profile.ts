import type { User } from './types.js';

export const isProfileComplete = (user: User): boolean =>
  user.gender !== null &&
  user.date_of_birth !== null &&
  user.height_cm !== null &&
  user.current_weight_kg !== null &&
  user.activity_level !== null &&
  user.goal_type !== null &&
  user.daily_calorie_goal !== null;
