---
title: Prerequisites
description: Accounts, tools, and credentials you need before cloning the repo.
sidebar:
  order: 1
---

Before you can run Tina Diet locally or contribute to the codebase, you need
a few accounts and tools set up.

## Local tools

| Tool | Version | Why |
|---|---|---|
| **Node.js** | `^22.0.0` | All projects target Node 22 (Cloudflare Workers requires it for wrangler 4) |
| **npm** | bundled with Node | Or pnpm/yarn — pick one and be consistent |
| **Git** | any recent | Clone, branch, commit |
| **`curl`** or **HTTPie** | any | API testing |
| **VS Code** | any recent | Recommended editor with these extensions: ESLint, Tailwind CSS IntelliSense, MDX |
| **`cloudflared`** | any recent | Public tunnel for LINE webhook → local backend during dev |

On Windows, install Node via [nvm-windows](https://github.com/coreybutler/nvm-windows)
to easily switch between Node 22 (this project) and other versions.

## Cloud accounts

You don't need ALL of these for read-only exploration of the codebase, but
each is required for a corresponding part of the system.

### Required for local dev (without payments)

- **GitHub** — clone the repo (`github.com/einsze/tinadiet`)
- **LINE Developers** ([developers.line.biz](https://developers.line.biz))
  - **Messaging API channel** for the bot (`LINE_CHANNEL_*`)
  - **LIFF channel** for the embedded app (`LIFF_ID`, `LINE_LOGIN_CHANNEL_ID`)
  - During dev you can use a personal test bot; production uses the live
    `@913civqx` channel.
- **OpenAI** ([platform.openai.com](https://platform.openai.com))
  - Project key with budget cap ($35/month for prod; even $5 for dev is fine)

### Required for payments testing

- **Omise** ([dashboard.omise.co](https://dashboard.omise.co))
  - TEST mode credentials — sign up is free, no business verification needed
  - For LIVE you need Thai business documents (ภพ.20, DBD registration,
    bank statement, director ID); see
    [Payments overview](/docsfordevtina/payments/overview/).

### Required for deploy

- **Railway** ([railway.app](https://railway.app)) — backend hosting,
  $5/month Hobby plan, Singapore region
- **Cloudflare** ([dash.cloudflare.com](https://dash.cloudflare.com)) —
  Workers (LIFF), Pages (docs), DNS, Registrar for `tinadiet.com`

## Recommended reading order

Once your accounts are in place:

1. [Local setup](/docsfordevtina/getting-started/local-setup/) — clone +
   install + run dev servers
2. [Architecture overview](/docsfordevtina/architecture/overview/) —
   understand the system you're touching
3. [Backend stack](/docsfordevtina/backend/stack/) — repos, services, routes
4. [LIFF stack](/docsfordevtina/liff/stack/) — frontend structure

## Secret handling

All secrets live in **environment variables**, never in code. There's a
file `c:\Users\carvi\AIchatbot\SECRETS_TINADIET_LOCAL.md` on the maintainer's
machine outside any git repo with the actual values — this is a personal
copy; for contributors, you'll need to provision your own test credentials
or be granted access.

**Never commit `.env` files.** Both `projects/backend/.gitignore` and
`projects/liff/.gitignore` exclude them; GitHub Push Protection is also
enabled to reject commits containing detected secrets.

See [Secrets rotation](/docsfordevtina/ops/secrets-rotation/) for ongoing
hygiene.
