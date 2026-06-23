---
title: Local Setup
description: Clone, install, and run backend + LIFF on your machine.
sidebar:
  order: 2
---

This walks you from zero to "bot replies to my messages on LINE in dev"
in about 15 minutes once accounts from [Prerequisites](/docsfordevtina/getting-started/prerequisites/)
are ready.

## 1. Clone

```bash
git clone https://github.com/einsze/tinadiet.git
cd tinadiet/projects
```

The git repository root is `projects/` (not the repo top-level). This is
historical; the monorepo lives one level below.

## 2. Install backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in (minimum to run):

```bash
SESSION_JWT_SECRET=        # generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
LINE_CHANNEL_ID=           # from LINE Developers Console
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LINE_LOGIN_CHANNEL_ID=
OPENAI_API_KEY=            # sk-proj-...
```

Leave `OMISE_*` and `STRIPE_*` empty for now — the backend gracefully
returns `503 OMISE_NOT_CONFIGURED` / `503 STRIPE_NOT_CONFIGURED` when these
are unset.

Run the backend:

```bash
npm run dev
```

It listens on `http://localhost:3000`. Verify with:

```bash
curl http://localhost:3000/healthz
# {"status":"ok","service":"tinadiet-backend","env":"development",...}
```

## 3. Install LIFF

In a separate terminal:

```bash
cd ../liff
npm install
cp .env.example .env
```

Fill the LIFF `.env`:

```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_LIFF_ID=               # from LINE Developers Console (LIFF tab)
```

Run the LIFF dev server:

```bash
npm run dev
```

Vite serves at `http://localhost:5173`. **Note**: the LIFF SDK won't init
correctly when you open `localhost:5173` directly in a normal browser
because it expects to run inside LINE's webview. To actually exercise the
LIFF, you'll need to point your LIFF channel's "Endpoint URL" to a public
tunnel URL (next step).

## 4. Expose backend via tunnel (for LINE webhook)

LINE's webhook calls your backend by URL. To receive webhooks during dev,
use cloudflared:

```bash
cloudflared tunnel --url http://localhost:3000
```

This prints a public URL like `https://random-name.trycloudflare.com`. Take
that URL and:

1. **In LINE Messaging API channel** → set "Webhook URL" to
   `https://random-name.trycloudflare.com/webhook/line` (note `/webhook/line`,
   not just `/`)
2. Click "Verify" — should return 200
3. Toggle "Use webhook" ON

Now send a message to your dev bot from LINE on your phone — the backend log
should show the event.

## 5. Expose LIFF via tunnel (to test in-LINE)

Open another tunnel for the LIFF Vite server:

```bash
cloudflared tunnel --url http://localhost:5173
```

Take the URL and **in LINE Developers Console** → LIFF tab → edit your LIFF
→ set "Endpoint URL" to `https://random-name-2.trycloudflare.com`.

Vite needs to know the tunnel hostname is allowed; the LIFF config already
has `server.allowedHosts: true` for dev.

Now opening LIFF from inside LINE will load your local Vite server. Hot
module reload works through the tunnel.

## 6. Run database migrations

Migrations run automatically when the backend starts (see
`backend/src/db/migrate.ts`). First run creates `backend/data/app.db` with
schema versions `0001` through `0007`. Verify:

```bash
ls -la backend/data/app.db
```

If the file isn't created, check backend logs for migration errors — the
most common cause is a missing parent directory (`backend/data/` must
exist; it's created via `.gitkeep`).

## 7. Test the full loop

In LINE on your phone:

1. Add your dev bot as a friend
2. Open the LIFF (via Rich Menu if set up, or directly via LIFF URL)
3. Complete the onboarding profile
4. Send a message to the bot like "ผัดกะเพราไก่"
5. Bot should reply with parsed food log in Thai

If anything breaks at this stage, check:

- Backend logs (`tsx watch` shows all output in real-time)
- LINE Messaging API channel "Webhook" tab → "Last delivery" shows status
  per recent webhook attempt
- Browser DevTools in LIFF (in LINE app: tap "︙" → "Webview tools")

## 8. Optional: enable Omise TEST mode for payment testing

Add to `backend/.env`:

```bash
OMISE_PUBLIC_KEY=pkey_test_...
OMISE_SECRET_KEY=skey_test_...
OMISE_WEBHOOK_SECRET=       # base64 secret from dashboard "Roll secret"
```

Get keys at `dashboard.omise.co/test/keys`. See
[Omise integration](/docsfordevtina/payments/omise/) for the full setup
including webhook registration.

Restart the backend after editing `.env`.

## Common gotchas

- **Backend says `OMISE_NOT_CONFIGURED`** — that's fine, expected when
  `OMISE_SECRET_KEY` is empty. Skip if you're not testing payments.
- **LIFF blank screen** — likely LIFF SDK init failed because endpoint URL
  doesn't match tunnel. Re-check LINE Developers Console LIFF endpoint URL.
- **Migration errors at startup** — usually means an old `app.db` from a
  previous version. Delete `backend/data/app.db` and restart to apply fresh.
- **better-sqlite3 build fails** — needs Node 22; check `node -v`. If still
  failing, `npm rebuild better-sqlite3`.
