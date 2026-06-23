---
title: Cloudflare — Admin Dashboard
description: How admin.tinadiet.com is deployed (Cloudflare Workers Static Assets, separate project from LIFF).
sidebar:
  order: 3
---

The admin dashboard at `admin.tinadiet.com` is deployed as a **separate
Cloudflare Workers project** from LIFF, using the same Workers Static
Assets pattern. This keeps bundles isolated (no admin code in LIFF and
vice versa) and lets the admin Worker have stricter security settings
(workers.dev URL disabled).

## Project: `tinadiet-admin`

- **Source**: `projects/admin/` in the [einsze/tinadiet](https://github.com/einsze/tinadiet) monorepo
- **Custom domain**: `admin.tinadiet.com`
- **workers.dev URL**: **DISABLED** (security — only the custom domain serves the dashboard)
- **Preview URLs**: **DISABLED** (same reason)
- **Auto-deploy**: push to `main` triggers Cloudflare build via the connected GitHub integration

## Initial setup (one-time)

1. **Create Cloudflare Worker project**
   - Cloudflare dashboard → Workers & Pages → Create application → Workers
   - Connect to GitHub → select `einsze/tinadiet` → branch `main`
   - **Worker name**: `tinadiet-admin`

2. **Build settings**

   | Field | Value |
   |---|---|
   | Root directory | (leave empty — defaults to `/`) |
   | Build command | `cd admin && npm install && npm run build` |
   | Deploy command | `cd admin && npx wrangler deploy` |
   | Path | `/` |

   **Critical**: the `.git` repo root is `projects/` (the parent of
   `admin/`, `backend/`, `liff/`, `docs/`). DO NOT prefix paths with
   `projects/`. Use `cd admin && ...`, not `cd projects/admin && ...`.

3. **Environment variables** (build-time, Vite)

   | Variable | Value | Purpose |
   |---|---|---|
   | `VITE_API_BASE_URL` | `https://api.tinadiet.com` | Backend URL embedded into the JS bundle |
   | `NODE_VERSION` | `22` | Wrangler 4 requires Node ≥ 22 |

   Neither needs to be encrypted (the API URL ships in client JS anyway).

4. **Add custom domain**
   - Tab **Domains** → **+ Add Domain** → input `admin.tinadiet.com`
   - Cloudflare auto-creates a CNAME record in the `tinadiet.com` zone
     and provisions SSL via Let's Encrypt
   - Wait ~30-90 seconds until status flips from **Provisioning** to
     **Active**

5. **(After custom domain is Active) Disable workers.dev URLs**
   - Tab **Domains** → **Worker URL** section
   - Toggle **Production** `tinadiet-admin.<account>.workers.dev` to OFF
   - Toggle **Preview** `*-tinadiet-admin.<account>.workers.dev` to OFF
   - These are also set in `wrangler.toml` (`workers_dev = false`,
     `preview_urls = false`) so future deploys preserve the setting

## `wrangler.toml`

```toml
name = "tinadiet-admin"
compatibility_date = "2026-06-01"

# Disable workers.dev URL + preview URLs so admin dashboard is reachable
# only via the custom domain admin.tinadiet.com (security hardening).
workers_dev = false
preview_urls = false

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

`not_found_handling = "single-page-application"` is what makes
react-router-dom v6 work — all unmatched paths serve `dist/index.html`
so client-side routing takes over. Don't use a Pages-style `_redirects`
file (Workers Static Assets rejects it with error 100324).

## Backend CORS

The backend at `api.tinadiet.com` allowlists the admin origin. See
[`backend/src/index.ts`](https://github.com/einsze/tinadiet/blob/main/projects/backend/src/index.ts):

```ts
const allowedOriginPatterns: Array<string | RegExp> = [
  'https://app.tinadiet.com',
  'https://admin.tinadiet.com',  // ← admin dashboard
  'https://liff.line.me',
  'http://localhost:5173',
  'http://localhost:5174',       // ← admin local dev
  /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/,
];
```

Workers.dev URLs are intentionally NOT in the allowlist — testing from
`tinadiet-admin.*.workers.dev` returns CORS error, which is correct
behavior given those URLs are disabled in production.

## First-time login

After deploy + custom domain active:

1. Open the admin dashboard URL
2. Login with the seeded superadmin account (credentials kept in the
   project owner's private secrets file outside the repo)
3. Navigate to **`/account`** and **change the password** to a
   high-entropy value (12+ chars, mixed case + symbols)
4. Navigate to **`/settings`** and configure:
   - `promptpay_id` — the client's PromptPay receiver number (10-digit
     mobile, or 13-digit Tax ID once business is registered)
   - `promptpay_id_type` — `mobile` / `nid` / `tax`
   - `promptpay_receiver_name` — name that appears on the slip
     confirmation screen in users' bank apps

Without `promptpay_id` set, `POST /api/v1/topup/manual/start` returns
503 `PROMPTPAY_NOT_CONFIGURED` — users can't create top-ups until you
fill this in.

## Ongoing operations

- **Deploy**: push to `main` → Cloudflare Build triggers automatically
  (~2-3 min). Check **Deployments** tab for build log
- **Rollback**: in Deployments tab, click an older deployment → "Promote
  to production"
- **Logs**: Tab **Observability** → real-time worker logs (Cloudflare Logs;
  `console.log` from build script only — admin runtime has no server-side
  logic, everything is static assets)
- **Backend logs**: see Railway dashboard (Logs tab on the backend project)

## Adding a new operator

Done entirely from the admin UI by a superadmin — no deploy or DB
edit needed:

1. Login as superadmin
2. Go to `/operators`
3. Click **New**
4. Fill email + password (≥ 8 chars) + display name + role
5. Share credentials via secure channel (1Password / Bitwarden / in person)
6. Tell the new operator to change password at first login via `/account`

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Build fails on `cd admin && ...` | Build settings have `Root directory = admin/` — clear it to `/` |
| Build fails: "wrangler requires Node v22+" | Missing `NODE_VERSION=22` env var |
| Login form shows "Failed to fetch" | Browser-side: origin not in backend CORS allowlist OR backend Railway hasn't deployed the commit that added admin endpoints. Hit `https://api.tinadiet.com/healthz` and check `commit` field. |
| Login form shows "Internal error" | Backend: `ADMIN_JWT_SECRET` env var unset AND `SESSION_JWT_SECRET` unset. Set at least one in Railway. |
| Login succeeds but 401 on next page | Token signature mismatch — different secret between login and verify. Check both backend instances if there's blue/green |
| `/payments/pending` blank | Normal if no submissions exist yet. Have a test user submit a top-up. |
| Slip image 404 | Slip file was deleted from `/data/slips/` (e.g. volume re-mount). Check Railway volume status. |
| Cannot toggle workers.dev URL off | Custom domain must be Active first. Wait for SSL provisioning. |

## Related

- [Admin overview](/docsfordevtina/admin/overview/) — UI walkthrough +
  role permissions
- [Cloudflare — LIFF](/docsfordevtina/deployment/cloudflare-liff/) — same
  pattern, separate project
- [Environment variables](/docsfordevtina/reference/env-vars/) — full
  list including admin-specific vars
