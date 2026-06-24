import type { ThemeSlug } from '../themes/catalog.js';

export type ThemeListItem = {
  slug: ThemeSlug;
  name_en: string;
  name_th: string;
  description_th: string;
  is_default: boolean;
  price_credit: number | null;
  for_sale: boolean;
  owned: boolean;
  is_active: boolean;
};

export type ThemeListResponse = {
  active_theme_slug: ThemeSlug;
  credit_balance_satang: number;
  themes: ThemeListItem[];
};

export type ThemePurchaseResponse = {
  theme_slug: ThemeSlug;
  credit_spent_satang: number;
  credit_balance_satang: number;
  active_theme_slug: ThemeSlug;
};

export type ThemeActivateResponse = {
  active_theme_slug: ThemeSlug;
};
