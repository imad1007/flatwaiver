# Permanent isolated staging

Prepared locally; no project was created, remote settings changed, migration applied, commit pushed or deployment performed. This document supersedes the earlier responsive-test failure status in the kiosk acceptance report: the outdated assertion was corrected and passes without UI changes.

## Audit findings

- Next.js 16.2.10, Vercel and hosted Supabase. Local environment files point to the main Supabase project; they are unsafe as staging inputs. The connected Supabase inventory previously showed the main project and an inactive Lead Engine project, with no main-project development branches. No staging app/project/test accounts were identified. Vercel account/project settings are not accessible through an installed connector, so deployment protection, remote variables, plan capabilities, domains and cron status are not verified.
- `vercel.json` schedules renewal and billing-expiry jobs. The staging project must disable these jobs until specifically tested. No staging Git/CI deployment automation is presently configured in the repo. Existing branch/deployment triggers on Vercel were not inspected.
- Migrations 0001–0027 define schema, RLS, storage, billing and group/DOB behavior. Apply the full ordered sequence to a fresh project. Never edit early schema/RLS migrations. 0026 introduces group evidence and search; 0027 updates the group validation function to accept DOB while preserving historical records. DOB is stored in participant JSON, not a new DOB column. No additional kiosk migration is needed; settings use `organizations.branding.kiosk`.
- Auth uses Supabase SSR cookies, PKCE `/auth/callback`, org-scoped RLS and server role checks. Public signers use the Node signing handler/service-role boundary, not anonymous database writes. Private `uploads`, `signatures`, `signed-pdfs` buckets are initialized by 0003. Signed records/versions are append-only, PDFs are created once and retained. Staging needs its own auth users, organizations and objects, not copied production data.
- Creem is the active provider with explicit test/prod selection; Stripe routes are dormant but remain callable if configured. Resend handles app transactional mail. Supabase Auth sends its own messages independently. Outbound org webhooks are database configured. A fresh staging database prevents inherited destinations but is insufficient if someone adds a production endpoint.
- Turnstile is verified server-side. Local keys are test keys; live staging widget/server verification has not occurred. The development seed bypass must remain disabled.
- SEO originally used `VERCEL_ENV=production`; a dedicated staging project's default target can also use that value. Analytics also had a production fallback property. Staging now explicitly opts out via `FLATWAIVER_ENV=staging`.

## Accounts/configuration the owner must supply

1. Vercel team, access to create/manage a separate project, Git repository authorization, plan-supported protection method, and approved costs. Use a project such as `flatwaiver-staging`; never link this workspace's CLI to production to deploy staging.
2. Supabase organization, approved separate-project region/plan/costs, permission to provision a new empty staging project, and its URL, project ref, anon and server-only service-role keys. Supply secrets through the platform vault/environment settings, not chat or tracked files.
3. Staging hostname/DNS administrator, e.g. a controlled `staging` subdomain, and a tester access list. Do not add production apex/www domains to the staging project.
4. A staging-only SMTP relay that captures all recipients without external delivery, its credentials, and a controlled mailbox/testing UI. This is required for real auth emails. Do not temporarily use production SMTP.
5. Staging Turnstile widget and secret, or the matched official test-key pair for automation; staging Creem test key/product/webhook secret if checkout is tested. No real payment details or live keys.
6. Synthetic owner/staff accounts in organization A and owner in B, plus a test fixture plan. OAuth, if enabled, requires separate OAuth client credentials and staging callback configuration.

Creation and deployment require approval after project choices and costs are concrete. No staging resource currently exists as a result of this work.

## Vercel configuration

Create a distinct project attached to the same repo only after approval. Choose the authorized staging branch; pin the accepted revision for each release candidate. Do not change production project branch/environment settings. Configure all scopes in the staging project with staging-only values, including its default/production target. Never inherit/copy production secrets.

Use Next.js framework defaults and a build command of `node scripts/check-staging-env.mjs && npm run build`. The preflight reads process environment only, never local `.env`, refuses the known main project, requires an explicit staging ref/URL, rejects unsafe baseline integration flags and checks legacy JWT project refs. Non-JWT key provenance and actual remote resources must still be verified in the new project's dashboard. Environment checks alone cannot prove which account issued opaque keys. The template is `config/staging.env.example`; it contains no credentials.

Set `FLATWAIVER_ENV=staging` in every staging deployment scope. For an approved deployment, enable Vercel Deployment Protection on the chosen staging host and all generated deployment URLs, including the dedicated project's default/production target. The available protection options depend on the account plan; confirm them before provisioning. If adequate Vercel protection is unavailable, use an approved access proxy covering every origin, not just the custom domain. Anonymous signed-waiver links are still anonymous within the app but must be accessible only to allowed staging testers at the infrastructure perimeter.

Do not rely on app login, robots or an obscure URL to protect staging. Verify an unauthenticated/incognito request is denied before enabling fixtures. Provision narrow access for browser tests; do not publish bypass tokens. Provider webhook endpoints may require an explicit narrow protection exception or an approved machine bypass arrangement. If the platform cannot safely expose just the test webhook path, leave sandbox billing hooks disabled and test them separately. Do not disable all deployment protection to make them work.

Disable the inherited Vercel cron jobs in the separate project until manually exercising them with synthetic data. App email remains disabled on staging, so durable mail tasks can remain pending/fail by design; do not treat that as evidence that provider email delivery works.

## Environment variable checklist

| Variables/settings | Staging | Production |
| --- | --- | --- |
| `FLATWAIVER_ENV` | `staging`, required in every scope | Unset or `production`; existing behavior retained |
| `STAGING_SUPABASE_PROJECT_REF` | New isolated project's reference | Not used |
| `NEXT_PUBLIC_APP_URL` | Separate HTTPS staging origin | Actual production origin |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New project's values, public identifiers only | Production project's values |
| `SUPABASE_SERVICE_ROLE_KEY` | New project's server-only key | Production server-only key |
| `ADMIN_EMAILS` | Empty initially or controlled staging admins | Existing approved admin allowlist |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Matched test keys for automation or dedicated staging widget | Real production widget/secret |
| `CREEM_SERVER` | `test` | Existing live/prod value |
| `CREEM_API_KEY`, `CREEM_PRODUCT_ID`, `CREEM_WEBHOOK_SECRET` | Sandbox-only, distinct secret; can stay empty initially | Existing approved live credentials |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | Unset; dormant | Existing dormant values unless separately activated |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Unset; app delivery disabled even if key accidentally present | Existing approved provider/sender |
| Supabase Auth SMTP | Capture-only relay; no external delivery, separate credentials | Approved production SMTP |
| Supabase auth site/redirect/OAuth | Staging origin and exact staging callback only | Production allowlist/client |
| `CRON_SECRET` | New random staging-only value; jobs disabled initially | Existing production value |
| `ANTHROPIC_API_KEY` | Unset in baseline | Existing production AI key |
| GA/Ads/Clarity/Tawk public variables, Google verification | Unset | Existing production values |
| `OPENAI_ADS_PIXEL_ENABLED`, `TIKTOK_PIXEL_ENABLED` | `false` | Existing approved values |
| `ALLOW_DEV_SEED` | Unset or `false` | Unset or `false` |
| Migration CLI access token/database password | Staging-scoped access held only by authorized runner | Separate approved production runner |
| Test protection bypass credentials | Staging-only vault; never browser/public variables | Not copied from staging |

Supabase Auth SMTP is configured outside Next env files. Restrict recipient delivery at the relay, including reset, magic-link, invitation and signup mail. Also disable or isolate Creem's own sandbox notifications; app mail guards cannot control provider email. Avoid importing production subscriptions, payment IDs, webhook endpoints, users, emails, PDFs or signatures.

Application safeguards added: staging Resend client is disabled; customer webhook dispatcher returns before any query/delivery; Creem must select test with a test-prefixed key; Stripe must use a test key if ever deliberately activated; robots disallows all, root metadata is noindex and response headers add `X-Robots-Tag`; analytics fallback is disabled. Production behavior is unchanged when the marker is absent. There is no staging email sink or outbound-webhook enable switch in this implementation: those app integrations are intentionally disabled. Testing their delivery later requires a separately reviewed capture-only transport/allowlist implementation. Kiosk signing and private evidence retrieval remain testable without them.

## Supabase setup and repeatable migrations

Create a fresh project, not a production clone/restore. Choose dashboard Auth Site URL as the staging origin; allow exact `/auth/callback` and any existing required `/auth/continue` flows on that host only, and configure the SMTP capture relay. If OAuth is enabled, register the new project's auth callback in its separate OAuth client. Do not add broad production redirect wildcards. Keep anon writes denied, RLS enabled, grants and function execution permissions exactly as the migrations define. Keep all three buckets private and check that file URLs originate from the staging project.

The Supabase CLI is not installed on this workstation, so no migration command was executed here. Install an approved pinned CLI version on an isolated staging runner, discover its current commands via `supabase --help`, `supabase link --help`, `supabase migration list --help` and `supabase db push --help`. Use explicit project selection in that runner rather than reusing a production `.temp` link. Verify the selected reference against the recorded staging project before every command.

Repeatable process:

1. Start from the exact candidate revision and a clean dedicated staging checkout/runner; secrets are supplied by its staging environment, never this workspace's local env files. Inspect ordered migration filenames/checksums and pending list.
2. Run local migration/contract tests first, including `verify:group-waivers`, `verify:data-transfers`, `verify:data-transfer-security` and migration safety checks. Test fresh initialization and synthetic legacy records against the candidate changes.
3. After infrastructure approval, link only the confirmed staging ref (`supabase link --project-ref <staging-ref>`), inspect `supabase migration list`, and inspect `supabase db push --dry-run` after confirming these flags in the installed version. Save the pending plan; ensure 0001–0027 are accounted for. Never run a remote reset on permanent staging.
4. Apply the reviewed pending migrations to staging with `supabase db push` only after target validation; do not repair/mark history applied instead of executing schema changes. Stop on failure and investigate partial state. Keep a recorded run log without passwords.
5. Inspect migration history and actual columns/functions/triggers/RLS/grants/bucket privacy. Run Supabase advisors. Test new and historical group records, per-participant DOB, immutability and org isolation. Seed synthetic fixtures through approved tools, not production backups.
6. Deploy the approved candidate to staging only after its schema prerequisites, run real acceptance, then record the exact revision, migration list, result IDs and evidence. Do not edit an already applied migration; add a new migration for fixes.
7. Production uses a separate runner/secret scope and explicit human approval. Review production drift/pending migrations and compatibility first; apply approved additive migrations before new writes, then deploy the same accepted revision. Do not assume staging success alone approves production.

Remote history alone does not prove schema compatibility; inspect 0026 group schema and trigger wiring and the 0027 DOB-aware validation function. Existing signed waivers, PDFs and versions must never be rewritten by testing or rollback. Periodic staging fixture growth should be managed via an approved retention strategy respecting append-only evidence, not ad hoc deletes.

## Kiosk acceptance gate

Follow `docs/kiosk-staging-acceptance.md` with a real isolated target and no signing/storage/PDF mocks. Test owner save → reload/new session, staff denial, second-org isolation; real widget/siteverify; one adult, two adults and adult with three children; all DOBs, independently acted signatures, guardian opt-in and distinct evidence paths; shared guardian edits requiring resigning; add/remove ordering; required fields and focused errors; Back/review; response loss/retry producing one original row/PDF; 150-second warning/continue, 180-second expiry and five-second success reset; no signing PII in storage; standard `/w` single/group submissions; original PDF download, CSV, historical records and check-in. Physically test tablet, French, accessibility and denied anonymous infrastructure access. Capture synthetic record IDs and compare version/evidence hashes without regenerating PDFs.

Official Turnstile test keys still use the real widget and validation API; they provide deterministic pass/fail/duplicate-token testing. Pair the correct site and secret key. Manually verify the staging real-widget hostname configuration separately before release. Test keys must never be production values.

## Local → staging → production

Every feature first passes local type/lint/unit/route/migration checks with synthetic data. Release candidates go to the isolated permanent staging project after approval, with identical code and environment-specific secrets. Migrations are reviewed/applied before dependent writes. Record live acceptance and unresolved risks; request production approval for that exact candidate. Production then uses its separately authorized deployment/migration process, followed by controlled smoke tests and monitoring.

Rollback restores the previously recorded known-good app build and environment, leaving additive migrations, settings JSON and all immutable evidence intact. Do not roll back below DOB support without compatibility review. Never regenerate old PDFs or delete signed records. Use existing idempotency reconciliation for interrupted submissions. Record the outcome and retest standard signing/downloads before reopening kiosk use.

## Local verification and remaining limitations

`node scripts/check-staging-env.mjs --self-test` and `node scripts/verify-staging-safety.mjs` pass: actual helpers prevent accidental outbound app mail/hooks and live billing, and staging noindex works even with `VERCEL_ENV=production`. The responsive test now passes on the current preview/scroll layout. Creem environment tests, billing gate, kiosk tests and TypeScript pass. These checks verify code/configuration contracts, not provisioned infrastructure. Credentials, protection, migrations and live services are not verified until new resources exist. All stage guards depend on the required marker; the dedicated project's preflight must be enforced on every deploy.

References: [Vercel project isolation](https://vercel.com/docs/projects), [deployment protection](https://vercel.com/docs/deployment-protection), [environment variable scopes](https://vercel.com/docs/environment-variables), [Supabase environment workflow](https://supabase.com/docs/guides/deployment/managing-environments), [migration workflow](https://supabase.com/docs/guides/deployment/database-migrations), [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

Final production build, application/scripts/config lint and group regression reruns passed after the staging guards. Run `npm run verify:staging` for their contract tests. No live staging acceptance was performed.
