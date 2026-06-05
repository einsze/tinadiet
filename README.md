# AI Nutrition Coach Thailand

LINE LIFF + Chatbot platform for Thai nutrition coaching.

> Specification & architecture: see [`../PRD_AI_Nutrition_Coach_Thailand.md`](../PRD_AI_Nutrition_Coach_Thailand.md)

## Repository layout

```
projects/
  backend/          Node.js + Express + SQLite monolith
                      - serves LINE webhook
                      - serves /api/v1 for LIFF
                      - serves built LIFF static files
  liff/             React + Vite + Tailwind LIFF SPA
  docs/             Architecture notes, runbooks, design files
  ops/              Deployment & infra config (Railway, GitHub Actions)
  .github/          CI workflows
```

Backend and LIFF are independent Node projects (separate `package.json`).
The backend serves the built LIFF bundle in production.

## Status

Pre-development. Infrastructure scaffolding only. No implementation code yet.

## Setup

Before writing any code, complete the **external setup checklist**:
[`docs/01-external-setup-guide.md`](docs/01-external-setup-guide.md)

Then:
1. Copy `.env.example` -> `.env` in `backend/` and `liff/` and fill in secrets.
2. `cd backend && npm install`
3. `cd liff && npm install`

## Versions

- Node.js 20 LTS (see `.nvmrc`)
- npm 10+

## License

Proprietary - client deliverable.
