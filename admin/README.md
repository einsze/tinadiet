# Tina Diet Admin Dashboard

Operator + superadmin dashboard for the Sprint 6 M4 manual top-up + credit
system. Hosted at `admin.tinadiet.com` (Cloudflare Workers Static Assets).

## Local development

```bash
# Backend must be running on http://localhost:3000 (see ../backend)
npm install
npm run dev          # http://localhost:5174
```

`VITE_API_BASE_URL` defaults to `http://localhost:3000`. For staging/prod
build, set it to `https://api.tinadiet.com`.

## Build

```bash
npm run build        # → dist/
npm run preview      # serve built bundle locally
```

## Deployment (Cloudflare Workers Static Assets)

This is a NEW Cloudflare Workers project, separate from `tinadiet-liff` and
`tinadiet-docs`.

1. **Create Worker project** in Cloudflare dashboard
   - Workers & Pages → Create application → Workers
   - Name: `tinadiet-admin`
   - Connect to GitHub repo `einsze/tinadiet`
   - Build settings:
     - Root directory: `admin` (git repo root is `projects/`, so `admin/`)
     - Build command: `cd admin && npm install && npm run build`
     - Deploy command: `cd admin && npx wrangler deploy`
   - Environment variables (build-time, Vite):
     - `VITE_API_BASE_URL=https://api.tinadiet.com`
     - `NODE_VERSION=22`
2. **Add custom domain**
   - Custom Domains → Add → `admin.tinadiet.com`
   - DNS auto-provisioned, SSL active in ~30s
3. **First deploy**: trigger by pushing to `main` (auto-deploy on push)

## Initial superadmin credentials

Migration `0008_credit_system` seeds initial superadmin row(s) for the
project owner. The actual emails and bcrypt-hashed passwords are baked
into the migration SQL — see `backend/src/db/migrations.ts`.

**Initial plaintext passwords are kept in the project owner's private
secrets file outside the repo.** Rotate via `/account` page after first
login.

## First-time setup checklist

After deploy:
1. Login with the seeded superadmin
2. Open `/settings`
3. Configure:
   - `promptpay_id` — your PromptPay receiver ID (mobile/NID/Tax ID)
   - `promptpay_id_type` — `mobile`, `nid`, or `tax`
   - `promptpay_receiver_name` — name shown to users below the QR
4. Optionally review premium bundle prices (defaults: 150/450/900/1800 credit)
5. Optionally adjust top-up limits + high-value threshold
6. Test by switching to `/operators` and creating a non-superadmin operator
