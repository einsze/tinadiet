---
title: Design System
description: Brand palette, typography, components, and conventions.
sidebar:
  order: 3
---

The LIFF is rose-pink branded ("Tina Diet"), Thai-first content, English
chrome. Mobile-first with safe-area handling for iPhone X+.

## Brand palette

Rose-pink, defined in `liff/tailwind.config.js` `theme.extend.colors.brand`:

| Shade | Hex | Use |
|---|---|---|
| `brand-50` | `#ffe4ec` | backgrounds, hover wash |
| `brand-100` | (lighter) | subtle backgrounds |
| `brand-200` | (mid-light) | borders, dividers |
| `brand-300` | (mid) | inactive accents |
| `brand-400` | (mid) | secondary buttons |
| `brand-500` | `#ec4571` | **primary brand color** (links, focused states) |
| `brand-600` | `#be3252` | hover state of brand-500 |
| `brand-700` | (darker) | active text, headings |
| `brand-800` | (darker) | high-emphasis text |
| `brand-900` | (darkest) | rarely used |

History: original sky-blue palette (`brand-500 = #0ea5e9`) was flipped to
rose-pink in Sprint 5 M3 to better match the female-coach brand identity.
All existing `text-brand-700`, `bg-brand-500`, etc. references automatically
render in the new color — palette flip was zero-friction.

## Typography

- **Font**: System UI stack (Tailwind default) — no web font for speed
- **Headings**: extra-bold (`font-extrabold`) for page titles, bold for
  sections
- **Body**: regular, comfortable line-height
- **Thai script**: same stack, renders well on iOS + Android

## Components

### AppShell (`components/AppShell.tsx`)

Top-level frame on every authenticated page.

```
┌─────────────────────────────────┐
│  Header (varies by route)        │
│  - / : brand hero header         │
│  - subpages : compact w/ icon    │
├─────────────────────────────────┤
│                                  │
│  <Outlet /> (route page)         │
│                                  │
├─────────────────────────────────┤
│  Bottom nav: 5 tabs              │
│  🏠 💬 ⭐ 👤 🆘                  │
│  + safe-area-inset-bottom        │
└─────────────────────────────────┘
```

Uses `lucide-react` icons (Home, MessageCircleHeart, Crown, UserCog,
LifeBuoy). Active state: 9×9 icon-pill with gradient brand-100→brand-200
+ ring-1 brand-200 + shadow-sm, icon `scale-110` + `strokeWidth: 2.4`.

### SubpageHeader

Inside AppShell, for non-root paths, renders:
- Icon-pill (matching BottomNav active style)
- Page title (gradient brand-600→500→400)
- Thai tagline (e.g. "ปรึกษานักโภชนาการส่วนตัวของคุณ" for /chat)
- ✨ corner sparkles at 25% opacity

Page metadata defined in `SUBPAGE_META` record keyed by route path.

### Dashboard sections

Composable sections that render on `DashboardPage`:
- `KcalRing` — SVG ring showing today's kcal vs goal
- `WeightSection` — wraps `WeightChart` (SVG line chart) with latest/target
- `ChatSection` — consultation Q&A panel (premium-gated, locked UI when
  free)
- `PremiumSection` — dual state (free vs premium), method picker for
  payment, projected expiry preview

### PromptPayQrModal

Full-screen modal for PromptPay payment. States:
- `pending` — QR image + countdown + polling
- `successful` — green checkmark + auto-close
- `expired` — amber warning + close button
- `failed` — rose warning + close button

ESC key closes the modal. Polling every 2s with cleanup on unmount.

### ProfileForm

Single-screen onboarding form (gender chips, native date picker, height
+ weight inputs, activity-level list, goal-type chips). Submits PATCH
`/users/me` → backend computes BMR/TDEE/macros → Dashboard renders.

## Gradients

Used sparingly for emphasis:
- Brand title: `bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400`
- Primary buttons: `bg-gradient-to-r from-amber-500 to-rose-500`
- Premium badge: `bg-gradient-to-r amber → rose`
- Premium card (free state): `bg-gradient-to-br from-rose-50 to-amber-50`

## Animations

Custom keyframes in `index.css` `@layer utilities`:
- `wiggle-float` — mascot animation (rotate ±2.5° + translateY 6px, 2.6s)
- `soft-float` — gentle vertical bob
- `pulse-ring` — expanding halo behind mascot
- `bounce-dot` — loading dots

Used in `AuthLoadingScreen`, `OnboardingSplash`, and decorative bg emoji.

## Mobile-first

- All sizing in `rem` / responsive utility classes (`sm:`, `md:`)
- Touch targets ≥ 44×44 px
- `pb-[env(safe-area-inset-bottom)]` on BottomNav for iPhone X+
- Bottom-sheet modal style on mobile (`items-end`), centered on desktop
  (`sm:items-center`)
- No hover-only interactions

## Icons

Use `lucide-react` exclusively (don't mix with emoji or other icon
libraries):

```tsx
import { Crown, Sparkles, Home } from 'lucide-react';

<Crown className="h-4 w-4 text-amber-600" strokeWidth={2.4} />
```

Emoji are still used for:
- Decorative bg (sakura 🌸, sparkles ✨ in floating accents)
- Quick numeric badges (🔥 streak)
- Status confirmations in bot replies (in backend, not in icon UI)

But for navigation, buttons, and structured UI, use lucide.

## Color tokens cheat sheet

| Use | Class |
|---|---|
| Brand primary text | `text-brand-700` |
| Brand button bg | `bg-brand-500 hover:bg-brand-600` |
| Brand button gradient | `bg-gradient-to-r from-amber-500 to-rose-500` |
| Card surface | `bg-white shadow-sm` |
| Brand subtle bg | `bg-brand-50` |
| Muted text | `text-slate-500` / `text-slate-600` |
| Body text | `text-slate-900` |
| Danger | `text-rose-700` (in palette, distinct from brand) |
| Success | `text-emerald-700` |
| Warning | `text-amber-700` |
