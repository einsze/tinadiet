---
title: Webhook Signature
description: Why Omise uses HMAC-SHA256, the verification algorithm, and the lesson learned.
sidebar:
  order: 3
---

Omise webhooks are authenticated via **HMAC-SHA256 signature** in the
`Omise-Signature` header. Not Basic Auth, not OAuth — HMAC over a
specific payload.

## The story (why this page exists)

Initial Sprint 6 M1 implementation assumed Basic Auth (with username +
password env vars). It was deployed and tested via webhook → discovered
Omise dashboard v2 doesn't expose Basic Auth fields anywhere. The only
security mechanism in the dashboard is the "Roll secret" button under
**Webhook secret**.

Refactored to HMAC-SHA256 in commit `beb88a2`. One wasted deploy cycle.

**Lesson**: Before writing webhook code, **open the provider's dashboard
webhook config page** and note what security options are exposed. Provider
docs sometimes lag the UI; the UI is the ground truth.

## The algorithm

```
expected_signature = HMAC_SHA256(
  key = base64_decode(OMISE_WEBHOOK_SECRET),
  message = Omise-Signature-Timestamp + "." + raw_request_body
)
```

Headers Omise sends:
- `Omise-Signature` — hex-encoded HMAC. During a 24-hour secret rotation
  window, contains **two comma-separated hex signatures**. Accept if either
  matches.
- `Omise-Signature-Timestamp` — Unix epoch seconds string.

The signed payload format: `<TIMESTAMP>.<RAW_BODY>` — concatenated with a
literal `.` separator, all UTF-8 bytes.

## Implementation

In `services/omise.ts`:

```ts
export const verifyOmiseSignature = (
  rawBody: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined
): boolean => {
  if (env.OMISE_WEBHOOK_SECRET.length === 0) {
    return true; // dev convenience, accept all when not configured
  }
  if (
    typeof signatureHeader !== 'string' ||
    signatureHeader.length === 0 ||
    typeof timestampHeader !== 'string' ||
    timestampHeader.length === 0
  ) {
    return false;
  }

  const secretBytes = Buffer.from(env.OMISE_WEBHOOK_SECRET, 'base64');
  if (secretBytes.length === 0) return false;

  const expected = createHmac('sha256', secretBytes)
    .update(`${timestampHeader}.${rawBody}`, 'utf8')
    .digest();

  // Header may contain 2 comma-separated sigs during 24h rotation
  const candidates = signatureHeader.split(',');
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (trimmed.length === 0) continue;
    const candidateBytes = Buffer.from(trimmed, 'hex');
    if (candidateBytes.length !== expected.length) continue;
    if (timingSafeEqual(candidateBytes, expected)) return true;
  }
  return false;
};
```

Key details:
- `Buffer.from(secret, 'base64')` — the dashboard secret is base64; **must
  decode** before using as HMAC key
- `timingSafeEqual` — constant-time compare (prevent timing attacks)
- Length check first — `timingSafeEqual` throws if lengths differ; reject
  early
- Comma-split for rotation support — Omise rotates by sending two sigs for
  24h after a re-roll

## Route integration

The webhook route in `routes/webhook/omise.ts` MUST use `express.raw()`,
not `express.json()`, to get unmodified bytes:

```ts
router.post(
  '/omise',
  express.raw({ type: 'application/json', limit: '512kb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: { code: 'BAD_BODY' } });
      return;
    }
    const rawBody = req.body.toString('utf8');

    const sig = req.headers['omise-signature'];
    const ts = req.headers['omise-signature-timestamp'];

    if (!verifyOmiseSignature(rawBody, /* extract single string */ sig, ts)) {
      res.status(400).json({ error: { code: 'BAD_SIGNATURE' } });
      return;
    }

    const event = parseOmiseWebhookEvent(rawBody); // JSON.parse internally
    res.status(200).json({ received: true });

    // process async
    await handleOmiseEvent(event);
  }
);
```

The `express.json()` global parser is mounted AFTER all webhook routes in
`index.ts`, so this works.

## Failure modes & what we log

| Scenario | Response | Log |
|---|---|---|
| Missing signature header | 400 BAD_SIGNATURE | `warn webhook.omise.bad_signature has_sig:false` |
| Wrong signature | 400 BAD_SIGNATURE | `warn webhook.omise.bad_signature has_sig:true` |
| Non-Buffer body | 400 BAD_BODY | `error webhook.omise.body_not_buffer` |
| Invalid JSON | 400 BAD_BODY | `warn webhook.omise.parse_failed` |
| Shape invalid | 400 BAD_BODY | same |
| Handler error | 200 already sent | `error webhook.omise.handle_failed` |

Always 200 once signature+parse OK — Omise retries on non-2xx, and we
don't want to thrash the queue while our handler is buggy.

## Secret rotation

Roll the secret via Omise dashboard **Settings → Webhooks → Roll secret**.
The dashboard tells you the OLD secret remains valid for 24 hours, during
which Omise sends TWO signatures in the header (one with new secret, one
with old). Our verify function tries both.

Once you're confident the new secret is set in Railway env (and any
caches/restarts are done), the old secret can fully drop. In practice we
deploy, watch for any BAD_SIGNATURE logs, and roll again later if needed.

## Timestamp freshness?

Omise's docs example doesn't check timestamp freshness (which would
prevent replay attacks). Our implementation also doesn't.

**Reasoning**:
- Replay would re-deliver a `charge.complete` for a charge already marked
  successful — our idempotency check (`payment.status === 'successful' → no-op`)
  prevents any harm
- Pre-success replays would be flagged invalid by Omise itself (charge has
  moved on)
- The window of useful attack is narrow

If we wanted to add it later, check `abs(now - timestamp) < 5 minutes`
after sig verify; reject otherwise. ~3 lines of code.

## See also

- [Key invariants — Rule 2](/documentation/architecture/key-invariants/#2-express-webhook-routes-before-expressjson) — body parser order
- [Key invariants — Rule 3](/documentation/architecture/key-invariants/#3-payment-idempotency-via-early-return) — idempotency pattern
- [Omise integration](/documentation/payments/omise/) — charge flow
- Memory file `feedback-omise-webhook-signature` — original lesson notes
