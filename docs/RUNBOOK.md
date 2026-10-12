# Runbook

What to do when something goes wrong in production. For shipping changes, see
[RELEASE.md](RELEASE.md).

## Where things run

| Piece | Host | Configured by |
| --- | --- | --- |
| Frontend (`app/`) and `api/` functions | Vercel | Vercel project environment variables (`VITE_*` are baked into the bundle at build time) |
| Database, auth, storage, realtime | Supabase | `supabase/migrations`, dashboard settings |
| Notification email (`supabase/functions/notification-emails`) | Supabase Edge Functions | `supabase secrets` |
| PDF export (`pdf-service/`) | Container host | `PORT`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `SENTRY_DSN` |
| Doc Buddy and images (`ai-service/`) | Node host | `GROQ_API_KEY`, `ALLOWED_ORIGINS`, `RATE_LIMIT_PER_MINUTE`, `SENTRY_DSN` |

## Rolling back

**Frontend.** In Vercel, open Deployments, pick the last good production
deployment and choose *Instant Rollback* (or `vercel rollback <deployment-url>`).
The old build keeps the environment variables it was built with, so a rollback
also undoes an environment change that required a rebuild.

**Database.** There are no down migrations. Every migration is additive and
safe to re-run, and migrations ship *before* the app version that needs them
(see [RELEASE.md](RELEASE.md)), so rolling the frontend back does not require
touching the database. If a migration itself is wrong, fix it forward with a
new migration that reverses the change. If data was destroyed, restore from a
backup: Pro projects have daily backups and optional point-in-time recovery
under Database → Backups; Free projects have none, which is why the release
checklist takes a `supabase db dump` before risky migrations.

**PDF and AI services.** Redeploy the previous commit or image on their host.
Both are stateless.

## Restoring a paper

**The author can do it.** Version history in the editor lists snapshots: named
ones, the automatic one taken before a format switch, and both sides of an
edit conflict. *Restore* loads the snapshot into the editor; the next save
writes it. A paper in Trash can be restored from the dashboard's Trash tab for
30 days, after which `purge_trashed_documents` deletes it for good.

**Support can do it** from the Supabase SQL editor, which runs as the service
role and bypasses the owner checks. Find the paper and its snapshots:

```sql
select id, title, owner_id, deleted_at, version from documents where title ilike '%<words from the title>%';
select id, title, created_at from document_versions where document_id = '<paper id>' order by created_at desc;
```

Keep a copy of the current state, then restore the chosen snapshot:

```sql
insert into document_versions (document_id, title, content)
select id, 'Before support restore', content from documents where id = '<paper id>';

update documents d
set content = v.content,
    title = coalesce(nullif((
      select string_agg(n->>'text', '') from jsonb_array_elements(v.content->'titleBlock'->'title') n where n->>'type' = 'text'
    ), ''), 'Untitled paper')
from document_versions v
where v.id = '<snapshot id>' and d.id = v.document_id;
```

A paper in Trash comes back with `update documents set deleted_at = null where id = '<paper id>';`.
Restoring bumps the paper's `version`, so anyone who has it open is told it
changed elsewhere instead of silently overwriting the restore. A snapshot's
own `title` is its label ("Before switching to …"), so the paper title is
taken from the restored content, the same way the editor derives it on save.

A paper purged from Trash, or deleted along with its owner's account, is gone
except in backups.

## Rotating keys

Rotate immediately if a key may have leaked, and otherwise when someone with
access leaves. Create the new key, switch every consumer to it, confirm, and
only then revoke the old one.

| Key | Where it is used | How to rotate |
| --- | --- | --- |
| Supabase publishable (anon) key | Vercel `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY` | Project Settings → API Keys: create a new publishable key, update both Vercel variables, **redeploy** (Vite bakes it into the bundle), then delete the old key. |
| Supabase secret (service role) key | Edge Functions (injected automatically), any admin scripts | Create a new secret key, update scripts, delete the old key. Never put it in a `VITE_` variable. |
| Legacy JWT secret | Signs every session | Rotating it signs everyone out and replaces the legacy anon and service keys; prefer the new API keys above. |
| `GROQ_API_KEY` | ai-service | Create a key in the Groq console, set it on the host, restart, delete the old key. |
| `RESEND_API_KEY` | notification-emails | `supabase secrets set RESEND_API_KEY=…`, then revoke the old key in Resend. |
| `CRON_SECRET` | notification-emails and its cron job | `supabase secrets set CRON_SECRET=…`, then update the `x-cron-secret` header on the cron job. Runs in between are refused and nothing is claimed, so emails are only delayed. |
| `E2E_*` | GitHub Actions secrets for the e2e job | Change the test account's password, then update the secrets. |

The Sentry DSN and PostHog project key are public by design. If either is
abused, create a new client key in that product, swap it in Vercel and
redeploy.

## Supabase paused or unreachable

Free projects pause after about a week without activity. Symptoms: every
sign-in, save and load fails with a network error, and the app shows "we
can't reach our servers".

1. Supabase dashboard → the project → *Restore project*. It takes a few minutes.
2. Reload the app. If a request fails with *column … does not exist* or
   *function … does not exist*, the schema cache is stale or a migration is
   missing: run `notify pgrst, 'reload schema';` in the SQL editor, and if
   that does not help, run every file in `supabase/migrations` again, in
   order. They are all safe to re-run.
3. Check that realtime presence and the notification bell work; both depend on
   migrations 010 and 014.

To stop it recurring, upgrade the project or schedule a daily request to
`<project URL>/auth/v1/health` with the anon key.

## Monitoring

**Sentry** receives errors from the frontend (with 10% of page loads traced;
`VITE_SENTRY_TRACES_SAMPLE_RATE` changes that), pdf-service and ai-service.
URLs are stored without query strings or fragments, because share, export and
unsubscribe links carry tokens there. Events are tagged with the release
(`VITE_RELEASE`, or the Vercel commit SHA). Alerts to keep configured:

- Issue alert: a new issue is first seen in `production` → email the team.
- Metric alert: more than 20 errors in 5 minutes in `production`.
- Metric alert: p75 LCP of page loads above 2.5 s over 1 hour.
- Issue alert on pdf-service: any `Render timed out` event. A full render
  queue is not an error event; it reaches PostHog as `pdf_export_failed`
  with `status` 503.

**PostHog** receives only explicit events (no autocapture, no session
recording). The activation funnel is `signed_up` → `paper_created` →
`citation_inserted` → `pdf_exported` with a 14-day window; also chart
`pdf_export_failed` against `pdf_exported`, broken down by `stage`.

**CSP reports.** Browsers report Content-Security-Policy violations to
`/api/csp-report`, which logs one `[csp report] …` line per violation in the
Vercel function logs. The policy is report-only today. Once a couple of
weeks of production traffic show nothing unexpected, copy the
`Content-Security-Policy-Report-Only` value in `app/vercel.json` into the
enforced `Content-Security-Policy` header, keeping the report directives.
