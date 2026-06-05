# Secrets Registry (template)

> This file is a **template**. The real registry (with values) must NEVER be
> committed. Keep the populated copy in a password manager (1Password,
> Bitwarden) shared with the client.

For each secret, record:

| Field | Notes |
|---|---|
| Name | Matches `.env` key |
| Issued by | LINE / OpenAI / Stripe / Railway / etc. |
| Owner | Person responsible |
| Issued on | YYYY-MM-DD |
| Expires on | YYYY-MM-DD or "n/a" |
| Last rotated | YYYY-MM-DD |
| Storage | "1Password vault X" |
| Recovery | How to reissue if lost |

## Inventory

| Name | Issued by | Owner | Status |
|---|---|---|---|
| `LINE_CHANNEL_SECRET` | LINE Developers > Messaging channel | dev | pending |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers > Messaging channel | dev | pending |
| `LINE_LOGIN_CHANNEL_ID` | LINE Developers > Login channel | dev | pending |
| `LIFF_ID` | LINE Developers > Login > LIFF | dev | pending |
| `OPENAI_API_KEY` | OpenAI Platform | dev | pending |
| `STRIPE_SECRET_KEY` | Stripe Dashboard | dev | pending |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhooks | dev | pending |
| `LINE_PAY_CHANNEL_SECRET` | LINE Pay Merchant Center | dev | pending |
| `SESSION_JWT_SECRET` | Generated locally (`openssl rand -hex 32`) | dev | pending |
| `SENTRY_DSN` (backend) | Sentry project: nutricoach-backend | dev | pending |
| `VITE_SENTRY_DSN` (browser) | Sentry project: nutricoach-liff | dev | pending |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | B2 Cloud Storage | dev | pending (later) |

## Rotation cadence

| Secret | Cadence |
|---|---|
| LINE_CHANNEL_ACCESS_TOKEN | Quarterly |
| OPENAI_API_KEY | Quarterly |
| STRIPE_SECRET_KEY | On suspicion only (rotation breaks subscriptions briefly) |
| STRIPE_WEBHOOK_SECRET | When the endpoint URL changes |
| SESSION_JWT_SECRET | Annually OR immediately after any breach signal |
