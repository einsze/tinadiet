---
title: Omise Integration
description: HTTP client, charge creation, status sync, going LIVE.
sidebar:
  order: 2
---

`services/omise.ts` is a thin HTTP wrapper around Omise's REST API. **No
SDK** — we use native `fetch` directly. The package `omise-node` exists
but is loosely maintained and has weak types.

## Why no SDK?

- Native `fetch` (Node 20+) has zero deps
- Full TypeScript control over response types
- Easy to upgrade Omise API version (just bump env)
- No SDK breaking changes to worry about
- The API surface we use is small: 2 endpoints (`POST /charges`, `GET /charges/:id`)

## Setup

### 1. Get Omise TEST keys

Sign up at `dashboard.omise.co`. After email verification, navigate to
**Settings → Keys**. Copy:
- **Public key** (`pkey_test_...`) — for client-side tokenization (we don't
  use this — PromptPay + TrueMoney don't need it)
- **Secret key** (`skey_test_...`) — for backend API calls

Save to `backend/.env`:
```bash
OMISE_PUBLIC_KEY=pkey_test_...
OMISE_SECRET_KEY=skey_test_...
OMISE_API_BASE_URL=https://api.omise.co
OMISE_API_VERSION=2019-05-29
```

### 2. Roll webhook secret

In Omise dashboard **Settings → Webhooks**, click **Roll secret**. Copy
the base64 string (only shown once — re-roll if missed).

Save to `backend/.env`:
```bash
OMISE_WEBHOOK_SECRET=<base64 secret>
```

### 3. Register webhook URL

Same Webhooks page → set **Webhook endpoint** to:
```
https://api.tinadiet.com/webhooks/omise
```

For local dev with cloudflared tunnel:
```
https://random-name.trycloudflare.com/webhooks/omise
```

Click **Update**. Omise will start delivering events for any charges
created on this account.

## API calls

### Create a charge

```ts
const charge = await createOmiseCharge(user, 'promptpay');
// or
const charge = await createOmiseCharge(user, 'truemoney');
```

Internally calls `POST https://api.omise.co/charges` with:

**PromptPay**:
```json
{
  "amount": 15000,
  "currency": "thb",
  "source": { "type": "promptpay" },
  "metadata": {
    "tinadiet_user_id": "2",
    "line_user_id": "Uxxxxxxxx..."
  }
}
```

**TrueMoney**:
```json
{
  "amount": 15000,
  "currency": "thb",
  "source": { "type": "truemoney_jumpapp" },
  "return_uri": "https://app.tinadiet.com/premium?omise_return=1",
  "metadata": {
    "tinadiet_user_id": "2",
    "line_user_id": "Uxxxxxxxx..."
  }
}
```

Response (simplified):
```json
{
  "object": "charge",
  "id": "chrg_test_xxx",
  "status": "pending",
  "amount": 15000,
  "currency": "thb",
  "source": {
    "id": "src_test_xxx",
    "type": "promptpay",
    "scannable_code": {
      "image": {
        "download_uri": "https://api.omise.co/charges/.../downloads/..."
      }
    }
  },
  "authorize_uri": "https://api.omise.co/payments/.../authorize",
  "expires_at": "2026-06-14T07:00:00Z",
  ...
}
```

### Retrieve a charge

```ts
const charge = await retrieveOmiseCharge(chargeId);
```

`GET /charges/:id`. Used by `GET /api/v1/billing/omise/charge/:id` polling
endpoint to sync state with Omise.

### Sync helper

```ts
const payment = await syncChargeFromOmise(chargeId);
```

Combines retrieve + DB update + grant application if status changed to
`successful`. Used as a safety net when webhooks might be delayed.

## Charge lifecycle

```
pending → successful   (paid)
       → failed        (rejected by source)
       → expired       (24h elapsed for PromptPay, less for TrueMoney)
       → reversed      (post-success refund/reverse)
```

Webhook events fired:
- `charge.create` — initial
- `charge.complete` — status changed to `successful`
- `charge.update` — any other status change
- Possibly more (e.g. `charge.refunded`); we handle generically

## Grant computation

When a charge becomes `successful`:

```ts
const grant = computeGrantWindow(user, PAYMENT_GRANT_DAYS, now);
// grant.starts = max(now, user.premium_expires_at)
// grant.ends = grant.starts + 30 days

paymentsRepository.markCompleted({
  provider_charge_id: charge.id,
  completed_at: charge.paid_at,
  grant_starts_at: grant.starts,
  grant_ends_at: grant.ends,
  ...
});

userRepository.applyPremium(user.id, grant.ends);
```

The user is updated to `plan='premium', premium_expires_at=<grant.ends>`.

If user was already premium, the new `premium_expires_at` is later than
the previous one (stacking — see [Overview](/docsfordevtina/payments/overview/#grant-stacking)).

## TEST mode simulation

Since we don't have real PromptPay QR or TrueMoney app in TEST:

### PromptPay
1. Create charge from LIFF
2. QR shows with "TEST MODE" overlay
3. In Omise dashboard `dashboard.omise.co/test/charges`, find the charge
4. Click **Capture** / **Mark as paid**
5. Omise fires `charge.complete` webhook
6. Backend processes → premium extended
7. LIFF polling detects success → modal shows success state

### TrueMoney
1. Create charge from LIFF
2. LIFF redirects to `authorize_uri`
3. **Test simulator page** appears with 3 buttons:
   - Successful → triggers `charge.complete`
   - Failed → triggers status `failed`
   - Pending → leaves as `pending`
4. User clicks Successful
5. Omise redirects back to `return_uri` with `omise_return=1` query
6. LIFF detects query → reloads billing status

**No actual TrueMoney app needed in TEST mode.** The simulator is built
into Omise's test environment.

## Going LIVE

1. Client provides Thai business docs (ภพ.20 VAT cert, DBD business
   registration, bank statement, director ID/passport)
2. Submit verification in Omise dashboard
3. Wait approval (3-7 business days typical, up to 14 days)
4. Request PromptPay + TrueMoney method enablement in submission form
5. After approval, get LIVE keys from dashboard
6. Set Railway env:
   ```
   OMISE_PUBLIC_KEY=pkey_...        (no _test_)
   OMISE_SECRET_KEY=skey_...        (no _test_)
   OMISE_WEBHOOK_SECRET=...         (new LIVE webhook secret)
   ```
7. In Omise LIVE dashboard, register `https://api.tinadiet.com/webhooks/omise`
   as webhook endpoint, roll LIVE secret, set in Railway
8. **No code change needed** — backend behaves identically
9. Test with a single LIVE 150 THB payment using your own card/wallet
   (refund yourself afterwards to verify refund flow works too)

## Caveats

- **Charge expires_at**: PromptPay defaults to 24h, TrueMoney to ~10
  minutes. Our LIFF modal countdown reflects Omise's actual `expires_at`.
- **TrueMoney requires app**: in LIVE, user MUST have TrueMoney app
  installed. No fallback to web. Consider warning tooltip near method chip.
- **`expires_at` is UTC**: convert for display in user TZ.
- **`charge.create` arrives before LIFF returns from POST**: backend may
  receive webhook before the POST response completes. The payment row is
  inserted by POST first; webhook upserts based on UNIQUE constraint
  (idempotent).
