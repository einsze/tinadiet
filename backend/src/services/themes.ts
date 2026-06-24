import { systemSettingsRepository } from '../repositories/system_settings.js';
import type { SystemSettingKey, ThemeSlug } from '../domain/types.js';

export class ThemeError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_SLUG'
      | 'NOT_FOR_SALE'
      | 'PRICE_NOT_CONFIGURED'
  ) {
    super(message);
    this.name = 'ThemeError';
  }
}

export type ThemeCatalogEntry = {
  slug: ThemeSlug;
  name_en: string;
  name_th: string;
  description_th: string;
  is_default: boolean;
  price_setting_key: SystemSettingKey | null;
};

export const THEME_CATALOG: ReadonlyArray<ThemeCatalogEntry> = [
  {
    slug: 'default',
    name_en: 'Rose Pink',
    name_th: 'โรสพิงค์',
    description_th: 'ธีมตั้งต้นของ Tina Diet',
    is_default: true,
    price_setting_key: null,
  },
  {
    slug: 'sakura',
    name_en: 'Sakura',
    name_th: 'ซากุระ',
    description_th: 'สีชมพูพาสเทล กับกลีบซากุระโปรย',
    is_default: false,
    price_setting_key: 'price_theme_sakura_credit',
  },
  {
    slug: 'ocean',
    name_en: 'Ocean',
    name_th: 'มหาสมุทร',
    description_th: 'ฟ้าน้ำทะเล กับลายคลื่นเบาๆ',
    is_default: false,
    price_setting_key: 'price_theme_ocean_credit',
  },
  {
    slug: 'forest',
    name_en: 'Forest',
    name_th: 'ป่าไม้',
    description_th: 'เขียวสดชื่น กับลายใบไม้',
    is_default: false,
    price_setting_key: 'price_theme_forest_credit',
  },
  {
    slug: 'sunset',
    name_en: 'Sunset',
    name_th: 'พระอาทิตย์ตก',
    description_th: 'ส้มอบอุ่น เหมือนยามเย็น',
    is_default: false,
    price_setting_key: 'price_theme_sunset_credit',
  },
  {
    slug: 'midnight',
    name_en: 'Midnight',
    name_th: 'ราตรี',
    description_th: 'ม่วงเข้มสุดหรู กับลายดาวระยิบ',
    is_default: false,
    price_setting_key: 'price_theme_midnight_credit',
  },
];

const SLUG_SET = new Set<string>(THEME_CATALOG.map((t) => t.slug));

export const DEFAULT_THEME_SLUG: ThemeSlug = 'default';

export const isValidThemeSlug = (slug: string): slug is ThemeSlug =>
  SLUG_SET.has(slug);

export const findThemeBySlug = (slug: string): ThemeCatalogEntry | undefined =>
  THEME_CATALOG.find((t) => t.slug === slug);

export const requireTheme = (slug: string): ThemeCatalogEntry => {
  const t = findThemeBySlug(slug);
  if (t === undefined) {
    throw new ThemeError(`Unknown theme slug: ${slug}`, 'INVALID_SLUG');
  }
  return t;
};

export const getThemePriceCredit = (slug: ThemeSlug): number => {
  const theme = requireTheme(slug);
  if (theme.is_default || theme.price_setting_key === null) {
    throw new ThemeError(
      `Theme ${slug} is the free default and cannot be purchased`,
      'NOT_FOR_SALE'
    );
  }
  const n = systemSettingsRepository.getNumber(theme.price_setting_key, 0);
  if (n <= 0) {
    throw new ThemeError(
      `Theme ${slug} price not configured (key ${theme.price_setting_key})`,
      'PRICE_NOT_CONFIGURED'
    );
  }
  return n;
};

export type ThemePublicInfo = {
  slug: ThemeSlug;
  name_en: string;
  name_th: string;
  description_th: string;
  is_default: boolean;
  price_credit: number | null;
  for_sale: boolean;
};

export const buildPublicCatalog = (): ThemePublicInfo[] => {
  return THEME_CATALOG.map((t) => {
    if (t.is_default || t.price_setting_key === null) {
      return {
        slug: t.slug,
        name_en: t.name_en,
        name_th: t.name_th,
        description_th: t.description_th,
        is_default: t.is_default,
        price_credit: null,
        for_sale: false,
      };
    }
    const price = systemSettingsRepository.getNumber(t.price_setting_key, 0);
    return {
      slug: t.slug,
      name_en: t.name_en,
      name_th: t.name_th,
      description_th: t.description_th,
      is_default: false,
      price_credit: price > 0 ? price : null,
      for_sale: price > 0,
    };
  });
};
