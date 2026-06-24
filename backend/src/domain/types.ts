export type Plan = 'free' | 'premium';

export type SubscriptionProvider = 'stripe';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export type Subscription = {
  id: number;
  user_id: number;
  provider: SubscriptionProvider;
  provider_subscription_id: string;
  provider_customer_id: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentProvider = 'omise';
export type PaymentMethod = 'promptpay' | 'truemoney';
export type PaymentStatus =
  | 'pending'
  | 'successful'
  | 'failed'
  | 'expired'
  | 'reversed';

export type Payment = {
  id: number;
  user_id: number;
  provider: PaymentProvider;
  provider_charge_id: string;
  provider_source_id: string | null;
  method: PaymentMethod;
  amount_satang: number;
  currency: string;
  status: PaymentStatus;
  failure_code: string | null;
  failure_message: string | null;
  authorize_uri: string | null;
  qr_image_uri: string | null;
  expires_at: string | null;
  completed_at: string | null;
  grant_days: number;
  grant_starts_at: string | null;
  grant_ends_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';
export type GoalType = 'loss' | 'maintain' | 'gain';

export type User = {
  id: number;
  line_user_id: string;
  display_name: string | null;
  gender: Gender | null;
  date_of_birth: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: ActivityLevel | null;
  goal_type: GoalType | null;
  bmr_kcal: number | null;
  tdee_kcal: number | null;
  daily_calorie_goal: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  locale: string;
  timezone: string;
  plan: Plan;
  premium_expires_at: string | null;
  stripe_customer_id: string | null;
  omise_customer_id: string | null;
  credit_balance_satang: number;
  abuse_warning_count: number;
  is_blocked: boolean;
  active_theme_slug: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileInput = {
  gender: Gender;
  date_of_birth: string;
  height_cm: number;
  current_weight_kg: number;
  target_weight_kg: number;
  activity_level: ActivityLevel;
  goal_type: GoalType;
};

export type NutritionGoals = {
  bmr_kcal: number;
  tdee_kcal: number;
  daily_calorie_goal: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodLogSource = 'manual' | 'chat_regex' | 'chat_ai' | 'photo';

export type FoodLog = {
  id: number;
  user_id: number;
  logged_at: string;
  date: string;
  meal_type: MealType | null;
  food_name_th: string | null;
  food_name_en: string | null;
  quantity_text: string | null;
  kcal: number;
  kcal_low: number;
  kcal_high: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: FoodLogSource;
  raw_text: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type FoodLogTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  count: number;
};

export type WeightLogSource = 'manual' | 'chat';

export type WeightLog = {
  id: number;
  user_id: number;
  logged_at: string;
  date: string;
  weight_kg: number;
  note: string | null;
  source: WeightLogSource;
  created_at: string;
};

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

// ----- Admin / credit system (Sprint 6 M4) -----

export type AdminRole = 'superadmin' | 'operator';

export type AdminUser = {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_by_admin_id: number | null;
  created_at: string;
  updated_at: string;
};

// Public view of AdminUser (no password_hash). Returned by API.
export type AdminUserPublic = Omit<AdminUser, 'password_hash'>;

export type ManualPaymentStatus =
  | 'awaiting_slip'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'flagged_review'
  | 'revoked';

export type ManualPayment = {
  id: number;
  user_id: number;
  requested_amount_satang: number;
  actual_amount_satang: number | null;
  slip_file_path: string | null;
  slip_mime_type: string | null;
  slip_size_bytes: number | null;
  status: ManualPaymentStatus;
  reviewed_by_admin_id: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  flag_user_as_abuse: boolean;
  credit_granted_satang: number | null;
  revoked_by_admin_id: number | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type CreditLedgerSourceType =
  | 'manual_topup'
  | 'omise_topup'
  | 'admin_grant'
  | 'redeem_premium'
  | 'theme_purchase'
  | 'revoke_topup'
  | 'revoke_redeem';

export type ThemeSlug =
  | 'default'
  | 'sakura'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'midnight';

export type UserTheme = {
  id: number;
  user_id: number;
  theme_slug: string;
  price_credit_snapshot: number;
  purchased_at: string;
};

export type CreditLedgerEntry = {
  id: number;
  user_id: number;
  amount_satang: number;
  balance_after_satang: number;
  source_type: CreditLedgerSourceType;
  source_ref_id: number | null;
  admin_user_id: number | null;
  note: string | null;
  created_at: string;
};

export type UserFlagType = 'abuse_warning' | 'manual_block';

export type UserFlag = {
  id: number;
  user_id: number;
  flag_type: UserFlagType;
  reason: string | null;
  related_payment_id: number | null;
  flagged_by_admin_id: number;
  flagged_at: string;
  cleared_by_admin_id: number | null;
  cleared_at: string | null;
  clear_reason: string | null;
};

export type SystemSettingKey =
  | 'promptpay_id'
  | 'promptpay_id_type'
  | 'promptpay_receiver_name'
  | 'price_1mo_credit'
  | 'price_3mo_credit'
  | 'price_6mo_credit'
  | 'price_12mo_credit'
  | 'high_value_threshold_satang'
  | 'topup_min_satang'
  | 'topup_max_satang'
  | 'price_theme_sakura_credit'
  | 'price_theme_ocean_credit'
  | 'price_theme_forest_credit'
  | 'price_theme_sunset_credit'
  | 'price_theme_midnight_credit';

export type SystemSetting = {
  key: SystemSettingKey;
  value: string;
  updated_by_admin_id: number | null;
  updated_at: string;
};
