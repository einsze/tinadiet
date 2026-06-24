export type ThemeSlug =
  | 'default'
  | 'sakura'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'midnight';

export type ThemeAccent = {
  emoji: string;
  patternKind: 'petals' | 'waves' | 'leaves' | 'sunset' | 'stars' | 'sparkles';
};

export type ThemeMeta = {
  slug: ThemeSlug;
  name_en: string;
  name_th: string;
  accent: ThemeAccent;
};

export const THEME_META: Record<ThemeSlug, ThemeMeta> = {
  default: {
    slug: 'default',
    name_en: 'Rose Pink',
    name_th: 'โรสพิงค์',
    accent: { emoji: '🌸', patternKind: 'sparkles' },
  },
  sakura: {
    slug: 'sakura',
    name_en: 'Sakura',
    name_th: 'ซากุระ',
    accent: { emoji: '🌸', patternKind: 'petals' },
  },
  ocean: {
    slug: 'ocean',
    name_en: 'Ocean',
    name_th: 'มหาสมุทร',
    accent: { emoji: '🌊', patternKind: 'waves' },
  },
  forest: {
    slug: 'forest',
    name_en: 'Forest',
    name_th: 'ป่าไม้',
    accent: { emoji: '🌿', patternKind: 'leaves' },
  },
  sunset: {
    slug: 'sunset',
    name_en: 'Sunset',
    name_th: 'พระอาทิตย์ตก',
    accent: { emoji: '🌅', patternKind: 'sunset' },
  },
  midnight: {
    slug: 'midnight',
    name_en: 'Midnight',
    name_th: 'ราตรี',
    accent: { emoji: '🌙', patternKind: 'stars' },
  },
};

export const DEFAULT_THEME_SLUG: ThemeSlug = 'default';

export const isValidThemeSlug = (s: string | null | undefined): s is ThemeSlug =>
  s !== null && s !== undefined && s in THEME_META;

export const resolveThemeSlug = (s: string | null | undefined): ThemeSlug =>
  isValidThemeSlug(s) ? s : DEFAULT_THEME_SLUG;
