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
