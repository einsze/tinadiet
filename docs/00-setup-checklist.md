# Pre-Development Setup Checklist

Print or check off each item before Sprint 1 begins. Detailed steps are in
[`01-external-setup-guide.md`](01-external-setup-guide.md).

## Accounts & access

- [ ] GitHub account ready, SSH key on this machine
- [ ] GitHub repository created (private)
- [ ] LINE Business ID created
- [ ] LINE Developers Console accessible
- [ ] LINE Official Account created (the bot)
- [ ] ~~LINE OA verified~~ **DEFERRED** - apply for badge later
- [ ] OpenAI account with billing method
- [ ] OpenAI usage limit set (hard cap)
- [ ] Railway account with billing method
- [ ] ~~Stripe account~~ **DEFERRED** - revisit when premium features ship
- [ ] ~~LINE Pay merchant account~~ **DEFERRED** - submit first when payments are next
- [ ] Cloudflare account (DNS + WAF, free tier OK)
- [ ] Domain registered: **`tinadiet.com`**
- [ ] Sentry account (free tier)
- [ ] UptimeRobot account (free tier)

## Local toolchain

- [ ] Node.js 20 LTS (`node -v` -> v20.x)
- [ ] npm 10+
- [ ] Git
- [ ] GitHub CLI (`gh`) - optional but useful
- [ ] Railway CLI (`railway`) - for tailing logs locally
- [ ] VS Code with the recommended extensions (see `.vscode/extensions.json`)
- [ ] Cloudflare Tunnel (`cloudflared`) OR ngrok - for LIFF local dev

## LINE assets (created in Console)

- [ ] Provider created
- [ ] Messaging API channel created (the chatbot)
- [ ] Channel access token issued
- [ ] Channel secret recorded
- [ ] Webhook URL placeholder set (we'll point it to Railway later)
- [ ] "Auto-reply messages" turned OFF
- [ ] "Greeting messages" turned OFF or customized
- [ ] LINE Login channel created (under the SAME provider as Messaging)
- [ ] LIFF app created under the Login channel (Size: Full)
- [ ] LIFF Endpoint URL placeholder set
- [ ] Rich Menu drafted in Figma/Canva (6 tiles, 2500x1686 px)

## OpenAI

- [ ] API key created (project-scoped, not user-scoped)
- [ ] Hard usage limit configured (e.g. USD 50/month at start)
- [ ] Zero-retention / no-training policy enabled (PDPA requirement)
- [ ] Default model access verified: gpt-4o-mini, gpt-4o (incl. Vision)

## Railway

- [ ] Project created
- [ ] Service: empty Node service
- [ ] Persistent volume mounted at `/data`
- [ ] Region: Singapore (closest to Thailand)
- [ ] Secrets seeded from `backend/.env.example` (blank values OK at first)
- [ ] GitHub repo connected for auto-deploy on `main`
- [ ] Custom domain attached (after DNS configured)

## Stripe (DEFERRED)

> Skip entirely until premium features ship. When revisiting:

- [ ] Product "Premium Coach" created
- [ ] Recurring price $3 USD / month created (price ID recorded)
- [ ] Webhook endpoint registered (placeholder URL)
- [ ] Webhook signing secret recorded

## LINE Pay (DEFERRED)

> Skip entirely for MVP. **When restarting payments, submit LINE Pay
> application FIRST** (4-8 week approval window).

- [ ] Merchant ID issued
- [ ] Sandbox channel secret recorded
- [ ] Production application submitted (multi-week approval lead time)

## DNS

- [ ] Domain `tinadiet.com` nameservers point to Cloudflare
- [ ] CNAME record `api.tinadiet.com` -> Railway provided host (grey cloud / DNS only)
- [ ] CNAME record `app.tinadiet.com` -> Railway provided host (orange cloud OK)
- [ ] SSL: full (strict) once Railway cert issues
- [ ] Cloudflare "Always Use HTTPS" enabled

## Observability

- [ ] Sentry project created (Node) - DSN recorded
- [ ] Sentry project created (Browser) - separate DSN recorded
- [ ] UptimeRobot monitor for `/healthz` (5-min interval)
- [ ] UptimeRobot monitor for `/api/v1/ping` (5-min interval)

## Compliance

- [ ] PDPA consent text drafted (Thai + English)
- [ ] Privacy policy URL placeholder (`docs/legal/privacy.md` -> later hosted)
- [ ] Terms of service URL placeholder
- [ ] OpenAI Data Processing Addendum signed (if available for your account)

## Secrets registry

Track each secret in [`04-secrets-registry.md`](04-secrets-registry.md) (NEVER in git):
- where it was issued
- when it expires
- who has access
- last rotation date

---

When every box above is checked, Sprint 1 can begin.
