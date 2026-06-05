# Deployment Runbook (template)

> Fill in concrete commands and IDs once Railway is provisioned (Sprint 1).

## Environments

| Environment | Branch | URL | Purpose |
|---|---|---|---|
| local | feature branches | http://localhost:3000 | Solo-dev iteration |
| preview | PRs | Railway-issued | Per-PR ephemeral env |
| production | `main` | https://api.tinadiet.app | Live |

## Deploy flow

1. Open PR -> CI runs (`lint`, `test`, `build`).
2. Merge to `main` -> Railway auto-deploys.
3. Post-deploy smoke test (see below) runs from a GitHub Action on a cron.

## Smoke tests (post-deploy, ~30s)

- `GET /healthz` -> 200, `{ status: "ok", commit: "<sha>" }`
- `GET /api/v1/ping` -> 200
- LINE webhook reachability ping (a manual "/ping" from the OA)
- LIFF loads -> profile fetch succeeds with a test account's token

## Rollback

Railway -> Deployments -> select previous successful deploy -> "Redeploy".
Database migrations are forward-only; rollback drops *code* only. For data
issues see [`03-incident-runbook.md`](03-incident-runbook.md).

## Database migrations

- Migrations live in `backend/db/migrations/NNNN-name.sql`.
- Applied at boot by a startup script (idempotent).
- Each migration is reviewed in the PR that adds it.
- Schema changes follow expand -> migrate -> contract for breaking changes.

## Backups

- Nightly 03:00 ICT: SQLite snapshot via `sqlite3 .backup` to a timestamped
  file inside the volume.
- Weekly: same snapshot copied off-Railway (Backblaze B2 bucket).
- Restore test: monthly, drill documented in `03-incident-runbook.md`.

## Secrets rotation

- Quarterly cadence for all secrets.
- LINE channel access token rotates via console (set new -> deploy -> revoke old).
- Stripe webhook secret: add new endpoint, switch env, delete old.
- OpenAI key: generate new -> set env -> revoke old.
