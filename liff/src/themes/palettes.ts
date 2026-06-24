import type { ThemeSlug } from './catalog.js';

/**
 * Brand color ramp per theme. Each shade is stored as a space-separated RGB
 * triple, ready to drop into Tailwind's `rgb(var(--brand-500) / <alpha-value>)`.
 */
export type BrandRamp = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export const PALETTES: Record<ThemeSlug, BrandRamp> = {
  default: {
    50: '255 245 247',
    100: '255 228 234',
    200: '253 202 214',
    300: '251 165 185',
    400: '247 114 147',
    500: '236 69 113',
    600: '209 42 89',
    700: '175 31 73',
    800: '145 28 65',
    900: '122 28 60',
  },
  sakura: {
    50: '253 242 248',
    100: '252 231 243',
    200: '251 207 232',
    300: '249 168 212',
    400: '244 114 182',
    500: '236 72 153',
    600: '219 39 119',
    700: '190 24 93',
    800: '157 23 77',
    900: '131 24 67',
  },
  ocean: {
    50: '240 249 255',
    100: '224 242 254',
    200: '186 230 253',
    300: '125 211 252',
    400: '56 189 248',
    500: '14 165 233',
    600: '2 132 199',
    700: '3 105 161',
    800: '7 89 133',
    900: '12 74 110',
  },
  forest: {
    50: '240 253 244',
    100: '220 252 231',
    200: '187 247 208',
    300: '134 239 172',
    400: '74 222 128',
    500: '22 163 74',
    600: '21 128 61',
    700: '22 101 52',
    800: '20 83 45',
    900: '5 46 22',
  },
  sunset: {
    50: '255 247 237',
    100: '255 237 213',
    200: '254 215 170',
    300: '253 186 116',
    400: '251 146 60',
    500: '249 115 22',
    600: '234 88 12',
    700: '194 65 12',
    800: '154 52 18',
    900: '124 45 18',
  },
  midnight: {
    50: '250 245 255',
    100: '243 232 255',
    200: '233 213 255',
    300: '216 180 254',
    400: '192 132 252',
    500: '168 85 247',
    600: '147 51 234',
    700: '126 34 206',
    800: '107 33 168',
    900: '88 28 135',
  },
};

const SHADE_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/**
 * Apply a theme by writing CSS custom properties on `<html>` and setting
 * `data-theme` for any CSS that wants to scope decorative overlays.
 */
export const applyTheme = (slug: ThemeSlug): void => {
  const ramp = PALETTES[slug];
  const root = document.documentElement;
  for (const k of SHADE_KEYS) {
    root.style.setProperty(`--brand-${k}`, ramp[k]);
  }
  root.dataset.theme = slug;
};
