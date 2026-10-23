# Runbook

Operating the production deployment. For local dev setup, see [`README.md`](./README.md); for architecture, see [`CLAUDE.md`](./CLAUDE.md).

## Production environment

- **Host**: Sevalla (Docker, `build_type: dockerfile` — the image bundles TeX Live, so `pdflatex` needs nothing extra on the host).
- **App**: `resumepress-trft1`, single `web` process (s1: 500m CPU / 1GB RAM, 1 instance), domain `resumepress.graysonpenland.com` (SSL active).
- **Database**: `resumepress-db-g597z`, managed Postgres 16.
- **Deploy trigger**: `auto_deploy: true` on the `main` branch — every merge to `main` deploys automatically. No manual deploy step exists or is needed.

## Deploying

Nothing to do beyond merging a PR to `main`. Sevalla picks it up automatically and has deployed every merge successfully in this project's history so far, typically in under 2 minutes. If you need to confirm a deploy landed or watch one in progress, check the Sevalla dashboard's deployment list for the app, or ask Claude Code (which has Sevalla MCP tools) to check `get_deployment`/`list_deployments` for `resumepress-trft1`.

## Rolling back

If a deploy ships a regression: Sevalla supports rolling back to any previous successful deployment for the app (each one is tied to a specific commit/Docker image). Do this from the Sevalla dashboard, or ask Claude Code to call `rollback_deployment`. This only rolls back the app container — it does **not** revert a database migration. If the bad deploy included a schema migration, rolling back the app without addressing the migration can put code and schema out of sync; check what changed before rolling back silently.

## Database backups

Sevalla takes automatic daily backups of `resumepress-db-g597z` with a 7-day retention window — this is already active, not something this project configured manually. To restore from one: use the Sevalla dashboard's database backup list, or ask Claude Code to check `get_database` for the current backup list and restore from there. There is no separate off-platform backup; if you want backups outside Sevalla's retention window, that's a gap to close deliberately, not something currently in place.

## Checking logs

Ask Claude Code (Sevalla MCP tools) to pull `get_deployment_logs` for a specific deployment, or `search_runtime_logs` / `search_access_logs` for the running app — or use the Sevalla dashboard directly.

## Common operational tasks

**Add or remove an allowed user.** Edit `ALLOWED_EMAILS` (comma-separated) in the app's environment variables on Sevalla, then redeploy (env var changes apply at the next deployment — trigger one manually if nothing else is pending). Also add/remove them from the Google Cloud OAuth consent screen's **Test users** list — this is a second, Google-enforced allowlist layer that blocks anyone not on it before they ever reach the app (see `docs/MIGRATION_PLAN.md` §1.2, risk 7). Both lists need updating; `ALLOWED_EMAILS` alone is not sufficient while the OAuth client is in "Testing" publishing status.

**Reconnect Gmail.** If a user's Gmail sync starts failing with a token/refresh error (the `/settings/gmail` page surfaces this inline), the fix is to click "Disconnect" then "Connect Gmail" again to redo the OAuth handshake. This is also the expected recovery path if Google's OAuth consent screen is still in "Testing" publishing status, which historically limits `gmail.readonly` refresh tokens to roughly a 7-day lifetime before requiring re-consent (see `docs/MIGRATION_PLAN.md` §6, risk 7) — this has not been independently re-verified against current Google behavior, so if sync silently stops working after about a week, check this first.

**Rotate a secret** (`AUTH_SECRET`, `GMAIL_TOKEN_ENCRYPTION_KEY`, `AUTH_GOOGLE_SECRET`). Update the value in Sevalla's environment variables and redeploy. Rotating `GMAIL_TOKEN_ENCRYPTION_KEY` invalidates every already-stored encrypted Gmail refresh token (they were encrypted with the old key) — every connected user will need to reconnect Gmail afterward. Rotating `AUTH_SECRET` invalidates existing NextAuth sessions — everyone gets signed out and needs to sign in again.

## Known limitations to keep in mind

- **No automated test suite.** CI runs `tsc --noEmit` and `npm run build` only — this catches type errors and build failures, not logic regressions. Decided deliberately (2026-10-23) given this app's personal/small-scale use; manual testing has in practice caught real bugs (GitHub issue #17, two Gmail-matching bugs) that type-checking wouldn't have. Revisit if this app ever needs to support more than a couple of trusted users or sees heavier day-to-day use.
- **Gmail sync is the least-proven module.** Its matching/sync logic was built and iterated on based on manual testing against a live account, but no session building it has had direct network access to test against the Gmail API itself. If sync behaves unexpectedly, check `/triage` and `/settings/gmail`'s inline error messages first.
- **No off-platform database backup.** Sevalla's daily/7-day backups are the only backup currently in place (see above).
