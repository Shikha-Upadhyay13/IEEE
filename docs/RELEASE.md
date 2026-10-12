# Releasing

## Environments

| | Supabase project | Frontend | Services |
| --- | --- | --- | --- |
| Local | your own project, or `supabase start` (needs Docker) | `npm run dev` | `npm start` in each service |
| Staging | a separate Supabase project, never shared with production | Vercel **Preview** deployments (every pull request and non-main branch) | staging instances of pdf-service and ai-service |
| Production | the production Supabase project | Vercel **Production** deployment from `main` | production instances |

Set this up once:

1. Create the staging Supabase project and apply every file in
   `supabase/migrations` (or `supabase link --project-ref <staging ref>` and
   `supabase db push`). Configure Auth the same way as production: TOTP
   multi-factor, "Secure password change", the site URL and redirect URLs of
   the preview deployments.
2. In the Vercel project, give the **Preview** environment the staging values
   of `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `VITE_PDF_SERVICE_URL`, `VITE_AI_SERVICE_URL` and
   `VITE_SENTRY_ENVIRONMENT=staging`, and the **Production** environment the
   production values.
3. Add the preview domain pattern to `ALLOWED_ORIGINS` on the staging services.
4. Create two test accounts in the staging project, without two-factor
   sign-in, and set the GitHub secrets `E2E_EMAIL`/`E2E_PASSWORD` and
   `E2E_EMAIL_2`/`E2E_PASSWORD_2`, so the signed-in editor flow and the
   sharing and comments flow run in CI.

`supabase db push` records what it applied in its own history table. On a
project whose migrations were pasted into the SQL editor that history is
empty, so the first push applies every file again; that is safe because every
migration is re-runnable.

## Checklist

Migrations go out first, and each one must keep the version of the app that
is currently live working. Never rename or drop something the live app still
uses; add the new thing, ship the app that uses it, and remove the old thing
in a later release.

1. CI is green on the commit being released: app (including the bundle-size
   budget), e2e (including the Content-Security-Policy check), services,
   database tests, and migrations on the real Supabase stack.
2. Read the new migrations. For each, confirm the live app keeps working
   with it applied. Note any dashboard setting it needs in the README.
3. If a migration rewrites or deletes data on a Free project, take a dump
   first: `supabase db dump --linked -f backup-$(date +%F).sql --data-only`
   with the production project linked.
4. Apply the new migrations to **staging**, then run `notify pgrst, 'reload schema';`.
5. On the Vercel preview deployment of the release, which talks to staging:
   sign in (with a second factor on the test account), create a paper, insert
   a citation, export a PDF, share it with a second account, comment, and
   check the notification arrives.
6. Apply the same migrations to **production**, then reload the schema cache.
7. Deploy pdf-service and ai-service if they changed. Both accept requests
   from the old and new frontend.
8. Merge to `main` (or promote the preview) to deploy the frontend.
9. For the next 30 minutes, watch the new release in Sentry and the
   `[csp report]` lines in the Vercel logs. If anything regresses, follow the
   rollback steps in [RUNBOOK.md](RUNBOOK.md).
