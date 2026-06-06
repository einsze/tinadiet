# External Setup Guide
### AI Nutrition Coach Thailand - everything to provision OUTSIDE the codebase

This guide walks through every external account, service, and asset that must
exist before Sprint 1 development can begin. Follow the order; later steps
depend on earlier IDs/URLs.

Total time: roughly **4-6 hours of focused work**, plus waiting periods
(LINE OA verification, LINE Pay approval).

Legend:
- [REQ] required for MVP
- [SP4] only needed by Sprint 4 (subscriptions / Vision)
- [LATER] optional / nice-to-have / scale-time

---

## STEP 0 - Prerequisites on your machine [REQ]

### 0.1 Install toolchain

| Tool | Why | How (Windows) |
|---|---|---|
| Node.js 20 LTS | Backend + LIFF build | https://nodejs.org -> LTS installer, or `winget install OpenJS.NodeJS.LTS` |
| Git | Source control | `winget install Git.Git` |
| GitHub CLI (`gh`) | Easy PR/repo ops | `winget install GitHub.cli` |
| VS Code | Editor | already installed |
| Cloudflare Tunnel | LIFF local dev over HTTPS | `winget install Cloudflare.cloudflared` |

Verify:
```
node -v     -> v20.x
npm -v      -> 10.x
git --version
```

### 0.2 Configure git identity

```
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

### 0.3 Generate an SSH key for GitHub

```
ssh-keygen -t ed25519 -C "you@example.com"
```
Press Enter through all prompts. Copy the public key:
```
type %USERPROFILE%\.ssh\id_ed25519.pub
```
Add it under GitHub -> Settings -> SSH and GPG keys.

---

## STEP 1 - GitHub repository [REQ]

1. Go to https://github.com/new.
2. Owner: your account or the client organization.
3. Repository name: `ai-nutrition-coach-thailand`.
4. **Visibility: Private**.
5. Do NOT add README / .gitignore / license - we already have them.
6. Create.
7. Locally:
   ```
   cd projects
   git init
   git branch -M main
   git add .
   git commit -m "chore: initial scaffolding"
   git remote add origin git@github.com:<owner>/ai-nutrition-coach-thailand.git
   git push -u origin main
   ```

### 1.1 Branch protection

GitHub -> Settings -> Branches -> Add rule for `main`:
- [x] Require pull request before merging
- [x] Require status checks (will appear once CI is added in Sprint 1)
- [x] Require linear history
- [x] Do not allow force pushes

---

## STEP 2 - LINE Business ID & Developers Console [REQ]

LINE separates "Business" (account holder) from "Developer" (technical user)
into one combined identity now. You only need one ID.

### 2.1 Create / log in

1. Go to https://account.line.biz/ -> Log in.
2. If new: register with a phone number or email and verify.

### 2.2 Create a Provider

A Provider is the company/owner of channels (bot + login).

1. https://developers.line.biz/console/ -> "Create a new provider".
2. Provider name: e.g. `Tina Diet Co.` (this name is shown to users in
   consent screens, so make it presentable in both Thai and English).
3. Create.

---

## STEP 3 - LINE Official Account (the chatbot face) [REQ]

The OA is what users add as a friend in LINE. The Messaging API channel sits
beneath it.

### 3.1 Create the OA

1. https://manager.line.biz/account -> "Create LINE Official Account".
2. Account name: `Tina Diet` (matches the brand). Choose carefully - changing
   later requires re-verification.
3. Category: "Health / Beauty -> Health Care".
4. Country: Thailand.
5. Sub-category: Nutrition.
6. Create.

### 3.2 Initial OA settings

Manager -> Settings -> Account settings:
- Profile picture (square logo, >= 640x640 px).
- Cover image (1280x720 px).
- Description (Thai + English).
- Status message ("Your Thai AI nutrition coach in LINE").

Manager -> Response settings:
- **Auto-response: OFF** (we control replies in code).
- **Webhooks: ON** (URL set later in Step 4).
- **Greeting message: Optional** - draft a welcoming text + a "Get Started"
  button that opens LIFF.

### 3.3 Verification (DEFERRED)

> **Client decision:** verification badge will be applied for later, once
> documents and brand are finalized. Not required for development or for
> friend-link distribution (QR code / `https://line.me/R/ti/p/<basic-id>`).

When ready: Manager -> Settings -> Account settings -> "Apply for verified
badge". Required documents (Thailand entity): company registration, ID copy.
Lead time: **2-4 weeks**. Verified accounts unlock search visibility and
display a green badge.

---

## STEP 4 - Messaging API channel (the bot) [REQ]

### 4.1 Create the channel

1. https://developers.line.biz/console/ -> select your Provider.
2. "Create a Messaging API channel".
3. Channel name: `Tina Diet Bot`.
4. Channel description: short blurb.
5. Category / sub-category: Health / Nutrition.
6. Email: your dev email.
7. **Important:** when prompted to link an OA, link the one from Step 3.
8. Create.

### 4.2 Channel secrets

In the channel page:

- **Basic settings tab** -> copy **Channel ID** and **Channel secret**.
  - Save these as `LINE_CHANNEL_ID` and `LINE_CHANNEL_SECRET`.

- **Messaging API tab** -> "Channel access token (long-lived)" -> Issue.
  - Save as `LINE_CHANNEL_ACCESS_TOKEN`.
  - This is a long string; treat it like a password.

### 4.3 Webhook (we set the URL after Railway deploy in Step 9)

- Webhook URL: leave blank for now, OR temporarily set to a tunnel URL for dev.
- "Use webhook": **ON**.
- "Auto-reply messages": **OFF** (set under "LINE Official Account features").
- "Greeting messages": OFF (handled in code) OR keep enabled for the initial
  welcome message.

### 4.4 Rich Menu (defer to Sprint 3, but design now)

Draft a 6-tile rich menu in Figma/Canva at **2500x1686 px**. Cells:
| Log food | Log weight | Summary |
| Coach | Dashboard | Premium |

Save as JPG/PNG < 1 MB. Uploaded via code in Sprint 3.

---

## STEP 5 - LINE Login channel (for LIFF) [REQ]

The LIFF SDK needs a **LINE Login** channel, which must be in the **same
Provider** as the Messaging API channel so user IDs match.

### 5.1 Create the channel

1. Same Provider page -> "Create a LINE Login channel".
2. Channel name: `Tina Diet LIFF`.
3. App types: **Web app** (only).
4. Email: same dev email.
5. Create.

### 5.2 Settings

Basic settings tab:
- Copy **Channel ID** -> save as `LINE_LOGIN_CHANNEL_ID`.
- (Channel secret is not needed for LIFF; it would be needed only if we did
  server-side OAuth without LIFF.)

LINE Login tab:
- Callback URL: not needed for LIFF (LIFF handles auth internally).
- Scopes: enable `profile` and `openid`.

### 5.3 Add a LIFF app under this channel

LIFF tab -> "Add":
- LIFF app name: `Tina Diet`.
- Size: **Full**.
- Endpoint URL: temporary `https://example.com` (we update after Step 9).
- Scope: `profile`, `openid` checked.
- Bot link feature: **On (Aggressive)** - so when users open LIFF and aren't
  yet friends with the bot, LINE prompts them to add it.
- Scan QR: optional (off at MVP).
- Module mode: off.
- Save.

After save, copy the **LIFF ID** (format `1234567890-abcdefgh`).
Save as `LIFF_ID`.

The LIFF URL users will open is `https://liff.line.me/<LIFF_ID>`.

---

## STEP 6 - OpenAI account [REQ]

### 6.1 Sign up

1. https://platform.openai.com/signup
2. Verify email + phone.
3. Billing -> add a card. Add **prepaid credits** ($20 to start) rather than
   pay-as-you-go if you want a strict hard cap.

### 6.2 Create a project (NOT a personal user key)

1. Top-right org/project dropdown -> "Create project".
2. Name: `nutricoach-prod`.
3. Allowed models: limit to `gpt-4o-mini`, `gpt-4o` (with Vision).
4. Save.

### 6.3 Issue an API key

1. Project -> API keys -> "Create new secret key".
2. Name: `backend-prod`.
3. Permissions: All (we'll narrow later).
4. Copy and save as `OPENAI_API_KEY`. **You cannot view it again.**

### 6.4 Hard usage limit (CRITICAL)

Settings -> Limits -> Usage limits:
- Hard limit: **USD 50/month** for the first month.
- Soft limit (email warning): **USD 35/month**.

### 6.5 Privacy / training opt-out (PDPA)

Settings -> Data Controls:
- "Improve the model for everyone": **OFF**.
- API data retention: **Zero data retention** if your account is eligible
  (requires approval - request via the Trust & Compliance page).

### 6.6 Save the org ID

Settings -> Organization -> copy "Organization ID" (`org-...`).
Save as `OPENAI_ORG_ID`.

---

## STEP 7 - Domain registration [REQ]

You need a domain because LINE/LIFF require HTTPS and a stable URL for the
webhook.

### 7.1 Choose & buy

- Project domain (chosen): **`tinadiet.com`**
- Registrar: Cloudflare Registrar (cheapest, no markup) recommended. Namecheap
  / GoDaddy also fine.
- Cost: ~USD 12/year for `.app`.
- `.app` is a Google-managed TLD - HTTPS is enforced (HSTS preload). This is
  fine for us because we use HTTPS everywhere anyway.

### 7.2 Move DNS to Cloudflare (recommended)

1. Sign up at https://cloudflare.com (free tier).
2. "Add a site" -> enter your domain.
3. Cloudflare lists current DNS records (likely empty) -> Continue.
4. Cloudflare gives you two nameservers. At your registrar, change
   nameservers to those two. Propagation takes 1-24h.
5. Once propagated, Cloudflare emails you.

### 7.3 Cloudflare settings

- SSL/TLS -> Overview -> **Full (strict)** (after Railway issues its cert).
- SSL/TLS -> Edge Certificates -> "Always Use HTTPS" **ON**.
- SSL/TLS -> Edge Certificates -> "Automatic HTTPS Rewrites" **ON**.
- Security -> Bots -> "Bot Fight Mode" ON (free).

DNS records (will be added after Step 9):
- `CNAME api -> <railway-target>` (proxied OFF for webhook URL)
- `CNAME app -> <railway-target>` (proxied ON for LIFF)

> Why proxied OFF for webhook: LINE signs webhook requests; Cloudflare can
> rewrite headers. Bypassing the proxy avoids subtle 5xx storms.

---

## STEP 8 - Railway (hosting) [REQ]

### 8.1 Sign up

1. https://railway.com -> sign up with GitHub (recommended) -> grant
   access to the new repo.
2. Add a payment method (Hobby plan is fine to start, $5 free credit).

### 8.2 Create the project

1. Dashboard -> "New Project" -> "Empty Project".
2. Name: `nutricoach-prod`.

### 8.3 Add the backend service

1. Inside the project -> "+ New" -> "Empty Service".
2. Settings -> Source -> "Connect Repo" -> select your GitHub repo, branch `main`.
3. Settings -> Build:
   - Root directory: `backend`
   - Build command: `npm ci && npm run build`  (defined in Sprint 1)
   - Start command: `npm run start`
4. Settings -> Environment -> paste every variable from
   `backend/.env.example`. Leave secret values empty for now or fill the ones
   you already have (LINE, OpenAI).
5. Settings -> Region: **Singapore** (`asia-southeast1`).

### 8.4 Add the persistent volume

1. Service -> Variables -> "+ Volume" (or Storage tab).
2. Mount path: `/data` (size 5 GB to start).
3. Update env `DATABASE_URL=file:/data/app.db`.

### 8.5 Generate a public domain

1. Service -> Settings -> Networking -> "Generate Domain".
2. You get something like `nutricoach-prod-up.railway.app`. Copy it.

### 8.6 Point your custom domain at Railway

1. Settings -> Networking -> "+ Custom Domain":
   - `api.tinadiet.com`
2. Railway shows a CNAME target. In Cloudflare DNS, add:
   - `CNAME api -> <railway-target>` (Proxy: **DNS only / grey cloud**)
3. Wait for Railway to verify (a few minutes) and issue an SSL cert.
4. Repeat for `app.tinadiet.com` (this will serve the LIFF static bundle).
   For this one you can keep proxy ON (orange cloud).

### 8.7 Save the URLs

- Backend public URL: `https://api.tinadiet.com` -> set `APP_BASE_URL`.
- LIFF page URL: `https://liff.line.me/<LIFF_ID>` -> set `PUBLIC_LIFF_URL`.

### 8.8 Update LINE webhook URL

Go back to LINE Developers Console -> Messaging API channel -> Messaging API
tab -> Webhook URL:
- `https://api.tinadiet.com/webhook/line`
- Click "Verify". If the backend service isn't deployed yet, this will fail -
  fine, return after Sprint 1's first deploy.

### 8.9 Update LIFF Endpoint URL

LINE Developers Console -> Login channel -> LIFF tab -> Edit LIFF app:
- Endpoint URL: `https://app.tinadiet.com/liff`
- Save.

---

## STEP 9 - Sentry (error monitoring) [REQ]

### 9.1 Two projects

1. https://sentry.io -> sign up (free tier: 5k errors/mo, plenty for MVP).
2. Create organization: `nutricoach`.
3. Create project **#1**: platform **Node.js**, name `nutricoach-backend`.
   Copy the DSN -> save as `SENTRY_DSN`.
4. Create project **#2**: platform **React**, name `nutricoach-liff`.
   Copy the DSN -> save as `VITE_SENTRY_DSN`.

### 9.2 Alerts

For both projects:
- Default alert: notify owner on any unresolved issue spike.
- Add Slack/email integration if available.

---

## STEP 10 - UptimeRobot (availability monitoring) [REQ]

### 10.1 Sign up

https://uptimerobot.com - free tier, 50 monitors at 5-min interval.

### 10.2 Monitors

Add two HTTP(S) monitors:
- `https://api.tinadiet.com/healthz` -> expect 200 within 30s.
- `https://app.tinadiet.com/liff` -> expect 200.

Configure email + LINE Notify alert (set up via LINE Notify, separate token).

---

## STEP 11 - Stripe [SP4, DEFERRED by client]

> **Client decision (2026-06-05):** SKIP for now. Will integrate both Stripe
> and LINE Pay together later (Sprint 4 or beyond). Free-tier-only launch is
> acceptable for the initial MVP. Reasons to revisit: when premium features
> (photo analysis, advanced coach, weekly report) are ready to ship.

When you return to this step:

### 11.1 Account

1. https://dashboard.stripe.com/register
2. Country: Thailand (or the entity that will collect revenue).
3. Activate account -> requires bank details + ID. Takes 1-3 business days.

### 11.2 Product + price

Dashboard -> Products -> Add product:
- Name: `Tina Diet Premium`.
- Pricing: Recurring, **USD 3.00 / month**, plan name "Premium Monthly".
- Save -> copy the price ID (`price_...`) -> save as
  `STRIPE_PRICE_ID_PREMIUM_MONTHLY`.

### 11.3 API key

Developers -> API keys -> Reveal **Secret key** -> save as `STRIPE_SECRET_KEY`.
(Use the test mode key during development; switch to live mode at launch.)

### 11.4 Webhook

Developers -> Webhooks -> Add endpoint:
- Endpoint URL: `https://api.tinadiet.com/webhook/stripe`
- Events: `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`.
- After save -> copy "Signing secret" -> save as `STRIPE_WEBHOOK_SECRET`.

### 11.5 Customer portal

Settings -> Billing -> Customer portal -> enable cancel + update payment
method. This gives users a Stripe-hosted page to manage their subscription.

---

## STEP 12 - LINE Pay [SP4, DEFERRED by client]

> **Client decision (2026-06-05):** SKIP for now (same as Stripe). When ready
> to start payments, **submit the LINE Pay merchant application FIRST** because
> approval takes 4-8 weeks - then provision Stripe in parallel during the wait.

LINE Pay is the local Thai payment rail. Application is heavier than Stripe.

### 12.1 Merchant application

https://pay.line.me/portal/global/main -> "Apply".
Documents (Thailand business):
- Company registration certificate
- VAT registration (if applicable)
- Bank account proof
- Director ID

**Lead time: 4-8 weeks** for production. Sandbox is faster.

### 12.2 Sandbox credentials

Once approved for sandbox:
- Sandbox URL: `https://sandbox-api-pay.line.me`
- Channel ID, Channel secret -> save as `LINE_PAY_CHANNEL_ID`,
  `LINE_PAY_CHANNEL_SECRET`.
- Set `LINE_PAY_ENV=sandbox`.

### 12.3 Production

Same fields, different host. Flip `LINE_PAY_ENV=production`.

---

## STEP 13 - Backblaze B2 (off-site backups) [LATER]

For nightly DB snapshots. Skip until Sprint 6.

1. https://www.backblaze.com/cloud-storage/sign-up
2. Create a bucket: `nutricoach-backups`, region close to Singapore.
3. Application keys -> create key scoped to that bucket -> save as
   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
4. Endpoint: `https://s3.<region>.backblazeb2.com` -> `S3_ENDPOINT`.

(B2 exposes an S3-compatible API, so any S3 SDK works.)

---

## STEP 14 - Legal / PDPA preparation [REQ before public launch]

This is content/document work, not technical. Start drafting in Sprint 1.

### 14.1 Documents to draft

- **Privacy policy** (Thai + English). Must disclose:
  - Data collected (health, weight, food, chat)
  - Purpose (nutrition coaching)
  - Third-party processors (OpenAI - explicitly named)
  - Retention periods
  - User rights (access, delete, export, withdraw consent)
  - Contact for data subject requests
- **Terms of service**
- **Consent screen copy** (shown in LIFF onboarding before profile creation)

### 14.2 Hosting

Host as static pages under `app.tinadiet.com/privacy` and `/terms`.
URLs must be reachable BEFORE launch - LINE OA verification checks for them.

### 14.3 OpenAI DPA

Request the Data Processing Addendum from OpenAI (Trust portal). Sign and
file in the secrets registry / contract folder.

---

## STEP 15 - Brand assets [REQ]

| Asset | Where used | Size |
|---|---|---|
| Logo (square) | OA profile, app icons | 1024x1024 PNG |
| Logo (wordmark) | LIFF header | SVG |
| OA cover image | OA profile | 1280x720 JPG |
| Rich menu image | Chat | 2500x1686 JPG |
| Favicon | LIFF | 32x32 + 192x192 |
| Open Graph image | LINE link previews | 1200x630 PNG |

Color palette (suggested - confirm with client):
- Primary: #0EA5E9 (sky)
- Accent: #1E3A8A (indigo)
- Background: #F8FAFC
- Text: #0F172A

---

## Final pre-Sprint-1 checklist

- [ ] All boxes in `00-setup-checklist.md` checked
- [ ] Secrets stored in 1Password / Bitwarden vault, NOT in git
- [ ] You can deploy a dummy backend to Railway and see it at
      `https://api.tinadiet.com/healthz`
- [ ] LINE webhook "Verify" succeeds
- [ ] You can open the LIFF URL from your phone (even if it shows a blank
      page - this proves the routing chain works)
- [ ] Sentry receives a manual test event from your laptop
- [ ] UptimeRobot is monitoring and shows "Up"

When all of these pass, you're ready for Sprint 1.

---

## Timing summary

| Block | Effort | Wait time |
|---|---|---|
| Step 0-1 (machine + GitHub) | 30 min | - |
| Step 2-5 (LINE) | 90 min | OA verification 2-4 weeks (non-blocking) |
| Step 6 (OpenAI) | 20 min | Zero-retention approval 1-2 weeks |
| Step 7 (Domain) | 15 min | DNS propagation up to 24h |
| Step 8 (Railway) | 45 min | SSL cert issuance ~10 min |
| Step 9-10 (Sentry + UptimeRobot) | 20 min | - |
| Step 11 (Stripe) | 30 min | Account activation 1-3 days |
| Step 12 (LINE Pay) | 60 min | Approval 4-8 weeks (deferrable) |
| Step 13 (B2) | 15 min | - |
| Step 14 (Legal) | external | depends on counsel |
| Step 15 (Brand) | external | depends on designer |

Total focused work: **~5 hours**. Wall-clock for everything ready: **2-3 weeks**
(driven by LINE OA verification and Stripe activation).
