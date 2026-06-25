---
title: Admin Dashboard
description: Operator and superadmin web UI at admin.tinadiet.com — pages, roles, auth model.
sidebar:
  order: 1
---

The admin dashboard at **`admin.tinadiet.com`** is the operator-facing
web app. Operators review manual top-up submissions; superadmins also
manage settings, users, and other admin accounts.

It's a **separate** Cloudflare Worker from the user-facing LIFF —
different bundle, different domain, different brand color (blue vs.
LIFF's rose-pink) so screenshots are unambiguous about which surface you're
looking at.

## Stack

Same as LIFF for consistency:
- Vite 6 + React 18 + TypeScript ESM (Vite bumped 5→6 in Dependabot Phase 2)
- Tailwind 3 (blue brand palette `#3b82f6` family)
- `react-router-dom` v6
- `lucide-react` icons
- Deployed to Cloudflare Workers Static Assets

Source: [`projects/admin/`](https://github.com/einsze/tinadiet/tree/main/projects/admin).

## Auth model

**Email + password → bcrypt verify → 8h JWT**.

- `admin_users` table stores email + `password_hash` (bcryptjs cost 10)
  + `role` (`superadmin` / `operator`) + `is_active` + audit fields
- Login at `/login` calls `POST /api/v1/admin/auth/login`
- Backend returns a JWT signed with `ADMIN_JWT_SECRET` (or fallback to
  `SESSION_JWT_SECRET` if unset). JWT has `audience: 'admin'` claim to
  prevent confusion with user-facing LIFF JWTs.
- Token stored in `localStorage` key `tinadiet_admin_token`
- Every request to `/api/v1/admin/*` includes `Authorization: Bearer <jwt>`
- Middleware `requireAdmin` decodes + verifies + re-checks the admin
  row still exists and is active on every request (so deactivating an
  operator invalidates their session within ~5 min)
- 401 from any admin endpoint triggers auto-logout in the client

## Roles

| Capability | Operator | Superadmin |
|---|:-:|:-:|
| Login + see dashboard | ✅ | ✅ |
| `/payments/pending` | ✅ | ✅ |
| `/payments/history` | ✅ | ✅ |
| Approve normal-value submission | ✅ | ✅ |
| Reject submission | ✅ | ✅ |
| Approve high-value submission (≥ threshold) | ❌ (auto-escalates) | ✅ |
| Approve flagged_review submission | ❌ | ✅ |
| Revoke approved submission | ❌ | ✅ |
| View users list + detail | ✅ | ✅ |
| Adjust user credit (`admin_grant`) | ❌ | ✅ |
| Clear user abuse warnings | ❌ | ✅ |
| Block / unblock user | ❌ | ✅ |
| View settings | ✅ | ✅ |
| **Edit settings** | ❌ | ✅ |
| Create / edit / delete operators | ❌ | ✅ |
| Change own password (`/account`) | ✅ | ✅ |

Enforcement is at **two layers**:
- Backend middleware `requireSuperadmin` on the relevant routes returns
  403 `FORBIDDEN` if `req.admin.role !== 'superadmin'`
- Frontend hides superadmin-only nav items and uses `<RequireSuperadmin>`
  router guard to redirect operators to a friendly "Forbidden" page if
  they navigate directly

You cannot bypass the backend by hand-crafting requests — the JWT's role
claim is re-checked against the DB on every request.

## Pages

| Path | Role | Purpose |
|---|---|---|
| `/login` | public | Email + password form |
| `/payments/pending` | both | Default landing. FIFO list of pending submissions |
| `/payments/history` | both | Filterable list (approved / rejected / revoked) |
| `/payments/:id` | both | Detail with slip viewer + approve/reject/revoke actions |
| `/users` | both | Search + flag filter |
| `/users/:id` | both | User detail + credit + warnings + ledger + flag history |
| `/gifts` | both | Gift list with status filter (Sprint 6 M6) |
| `/gifts/:id` | both | Gift detail. Superadmin sees Revoke button |
| `/settings` | superadmin | PromptPay + bundle pricing + original-price promo + theme prices + threshold + topup limits |
| `/operators` | superadmin | CRUD admin accounts |
| `/account` | both | Change own password |

`/` (root) redirects to `/payments/pending`.

## Layout

Desktop: left sidebar nav + main content area.

Mobile (< 768px): top header + bottom nav with 5 most-used tabs.
Operators in the field are mobile-friendly — though for slip review
desktop is much better (higher resolution, easier to read slips).

The current admin user's role is shown under the title in the sidebar
("SUPERADMIN" / "OPERATOR") so you know what permissions you have at a
glance.

## Initial superadmin seeding

Migration `0008_credit_system` seeds the initial superadmin row(s) so
the project owner can log in immediately after deploy. Initial
credentials are kept in a private secrets file outside the repo
(maintained by the project owner).

Owner has chosen to skip mandatory rotation — superadmins rotate
periodically on their own schedule via `/account`. Acceptable given:
- The admin dashboard `workers.dev` URL is disabled (only the custom
  domain `admin.tinadiet.com` resolves)
- Docs that mention `admin.tinadiet.com` are behind the obscure
  `/docsfordevtina/` path with `noindex` meta + `robots.txt` disallow
- Bcrypt cost 10 makes brute force at this scale impractical

If you're onboarding new superadmins, generate a high-entropy password
(12+ chars, mixed case + symbols) for them and have them rotate at
first login.

## Creating additional operators

Superadmin navigates to `/operators` → clicks **New** → fills email +
password (≥ 8 chars) + display name + role.

Backend creates the row with:
- `email` normalized to lowercase
- `password_hash` = bcrypt(password, cost=10)
- `created_by_admin_id` = the creating superadmin's id (audit trail)

The created admin receives no email — share credentials via secure
channel (1Password / Bitwarden / in person). Tell them to change
password at first login via `/account`.

To deactivate (not delete) an operator: edit the row, uncheck "Active".
Deactivated operators cannot log in but their audit footprint
(reviewed_by_admin_id on past payments) remains intact.

Deleting an operator entirely is destructive — past audit references
to their `admin_user_id` will dangle. Prefer deactivation. Delete is
available for accidentally-created accounts that never reviewed
anything.

## Security hardening (post-launch)

Already in place:
- ✅ Custom domain only (`workers.dev` URL disabled — see [Cloudflare
  Admin deploy guide](/docsfordevtina/deployment/cloudflare-admin/))
- ✅ Bcrypt cost 10 (~150ms per verify — adequate brute-force resistance
  at this scale)
- ✅ JWT audience claim separates admin from user tokens
- ✅ Backend re-checks `is_active` on every request
- ✅ Role enforcement at backend (frontend gating is UX only)

Recommended (open):
- 🟡 Set a SEPARATE `ADMIN_JWT_SECRET` env var (currently can fall back
  to `SESSION_JWT_SECRET`)
- 🔵 Restrict admin domain via Cloudflare Access (email allowlist or IP)
- 🔵 Add TOTP 2FA for admin login (would need new `admin_user_totp_secret`
  column + verify step)
- 🔵 App-level rate limit on failed login attempts per email

## Related docs

- [Manual top-up flow](/docsfordevtina/payments/manual-topup/) — what the
  operator is reviewing
- [Credit system](/docsfordevtina/payments/credit-system/) — what
  happens to the credit ledger when you approve
- [Cloudflare admin deploy](/docsfordevtina/deployment/cloudflare-admin/) —
  how the worker got deployed
