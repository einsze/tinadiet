# LIFF - AI Nutrition Coach Thailand

React 18 + Vite + Tailwind CSS + LINE LIFF SDK v2.

## Folder map

```
liff/
  public/             static assets served as-is (favicon, manifest, etc.)
  src/
    pages/            one component per route (Dashboard, FoodLog, Profile, ...)
    components/
      ui/             primitives (Button, Card, Sheet, Ring, ...)
      charts/         progress & trend charts (e.g. for the Progress page)
    lib/              app glue (liff init, env, formatters)
    hooks/            React hooks (useUser, useDailySummary, ...)
    api/              backend client (typed wrappers per endpoint group)
    state/            tiny client state (auth/session context)
    styles/           Tailwind base, fonts, design tokens
    i18n/
      th-TH/          Thai translation JSON
      en-US/          English translation JSON
    assets/
      icons/          inline SVG icons
```

## Required environment

See [`.env.example`](.env.example). Required keys before first run:
- `VITE_LIFF_ID` - from the LINE Login channel's LIFF app entry
- `VITE_API_BASE_URL` - the backend URL (localhost in dev, prod URL in build)

## Local development (Sprint 1+)

```
cp .env.example .env
npm install
npm run dev          # vite on http://localhost:5173
```

For LIFF features (`liff.getIDToken`, `liff.scanCode`, etc.) to work fully,
the page must be opened through LINE on a mobile device against an HTTPS URL.
For local dev we use a tunneling proxy (Cloudflare Tunnel or ngrok) - see
[`../docs/03-liff-local-dev.md`](../docs/03-liff-local-dev.md).

## Build & deploy

The production build is a static bundle (`dist/`) that the backend serves.
CI builds LIFF first, then deploys the backend with `dist/` baked in.

## Design notes

- Mobile-first. Tap targets >= 44px.
- Thai is the default language. English is a toggle.
- Fonts: `IBM Plex Sans Thai` + `Inter` (loaded from a self-hosted woff2).
- Color tokens defined in `src/styles/tokens.css`.
