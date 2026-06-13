---
title: Routing & Auth
description: Multi-page LIFF routing, public vs authenticated routes, AuthGate flow.
sidebar:
  order: 2
---

LIFF uses `react-router-dom` v6 for client-side routing, with a two-tier
structure: **public routes** that bypass LIFF auth (legal pages) and
**authenticated routes** for the actual app.

## Route map

```
/             ┐
/privacy      │ Public (no LIFF auth)
/terms        ┘

/             ┐  Authenticated:
/profile      │  1. Init LIFF SDK
/premium      │  2. Exchange access token for session JWT
/chat         │  3. Onboarding check (profile complete?)
/settings     │  4. Render AppShell + route component
/support      │
/*  (NotFoundPage)
```

## How public bypass works

In `App.tsx`, BEFORE initializing LIFF SDK:

```ts
function getPublicLegalDocument(): 'privacy' | 'terms' | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  if (path === '/privacy') return 'privacy';
  if (path === '/terms') return 'terms';
  return null;
}

export default function App() {
  const publicDoc = getPublicLegalDocument();
  if (publicDoc !== null) {
    return <LegalPage doc={publicDoc} />;
  }
  return <AuthenticatedApp />;  // LIFF init starts here
}
```

This makes `/privacy` and `/terms` accessible via plain browser (no LINE
context needed) — required for LINE OA business verification submission
and for general legal transparency.

The same pattern can be extended to add more public routes (e.g. a
`/help` public landing).

## AuthGate state machine

Inside `AuthenticatedApp`, the auth flow is a state machine:

```
idle → initializing → (1) needs_login → user_action → authenticating → ready
                       (2) authenticating directly → ready
                       (3) error
```

Implementation in `App.tsx` `AuthGate` component:

```ts
type AuthState =
  | { kind: 'idle' }
  | { kind: 'initializing' }
  | { kind: 'needs_login' }
  | { kind: 'authenticating' }
  | { kind: 'ready'; user: User; streak: number }
  | { kind: 'error'; message: string };
```

States render different UI:
- `idle`, `initializing`, `authenticating` → `AuthLoadingScreen` (mascot animation)
- `needs_login` → simple "Tap to login with LINE" button (LIFF auto-handles)
- `error` → `StandaloneShell` with error message + retry
- `ready` → onboarding splash if `!isProfileComplete(user)`, else `<Outlet />`

## Onboarding splash

If `ready` state but `daily_calorie_goal IS NULL`, render `OnboardingSplash`
instead of normal app. This blocks AI features until user fills profile.

After PATCH `/users/me` succeeds (computes BMR/TDEE/macros), state updates
and normal app renders.

## ShellLayout / AppShell

Once authenticated + onboarded, all subpages share:

```tsx
<ShellLayout>            // wraps everything below
  <AppShell>             // header + bottom nav
    <Outlet />           // React Router renders matched page
  </AppShell>
</ShellLayout>
```

`AppShell` checks `location.pathname` to decide:
- Root `/` → brand-style hero header
- Subpages → compact header with icon + title + tagline
- BottomNav: 5 tabs (Home / Ask Tina / Premium / Profile / Support)

## Route definitions

In `App.tsx`:

```tsx
<BrowserRouter>
  <Routes>
    <Route element={<AuthGate />}>
      <Route element={<ShellLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/premium" element={<PremiumPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
</BrowserRouter>
```

## Why react-router and not Next.js App Router?

LIFF is a SPA delivered as static assets. React Router gives us:
- File-routing convention without bringing in a server runtime
- Fully client-side, no need for Cloudflare Workers to know about routes
- `BrowserRouter` works with Cloudflare's SPA fallback
- Mature, well-understood

The SPA fallback config in `wrangler.toml` (`not_found_handling =
"single-page-application"`) makes Workers always serve `index.html` for
any path; React Router then takes over.

## Session token

After successful auth exchange, the session JWT is stored:

```ts
import { setSessionToken } from './lib/api.js';
setSessionToken(jwt);
```

`setSessionToken` is a module-level setter; the fetch wrapper (`lib/api.ts`)
reads it and attaches `Authorization: Bearer <jwt>` to every API request.

The token is **NOT** stored in localStorage — LIFF webview persists it
across page loads via the LIFF SDK's stored access token. On each LIFF
init, we re-exchange for a fresh session JWT. This avoids token-in-storage
risks (XSS, etc.).

## Deep links

LINE Rich Menu uses `https://liff.line.me/<LIFF_ID>/<path>` format for
deep linking. The LIFF SDK translates this to actual paths on
`app.tinadiet.com/<path>`, which Cloudflare SPA fallback delivers to
React Router, which renders the matching page.

E.g. Rich Menu cell "Premium" links to
`https://liff.line.me/2010309437-ER1WKReq/premium` → resolves to
`app.tinadiet.com/premium` → `PremiumPage` renders.
