# Import & Export

## Changed files

```text
package.json
package-lock.json
src/components/app-shell.tsx
src/components/data-management.tsx
src/proxy.ts
src/lib/data-transfer-auth.ts
src/lib/data-transfer-core.mjs
src/lib/storage-path.ts
src/app/api/files/sign-url/route.ts
src/app/(app)/data/page.tsx
src/app/(app)/data/records/page.tsx
src/app/(app)/data/records/[id]/page.tsx
src/app/api/data/jobs/route.ts
src/app/api/data/jobs/[id]/route.ts
scripts/data-transfer-worker.mjs
scripts/lib/data-transfer-worker.mjs
scripts/lib/data-transfer-io.mjs
scripts/lib/data-transfer-runtime.mjs
scripts/lib/data-transfer-test-db.mjs
scripts/verify-data-transfers.mjs
scripts/verify-data-transfer-security.mjs
supabase/migrations/0018_data_transfers.sql
docs/import-export.md
```

Local browser screenshots are in `output/data-ui/` and are not deployment files.
Existing email delivery, native signing/PDF generation and billing logic were
not modified by this feature.

## Scope and architecture

The owner dashboard at `/data` extends the existing storage, authorization,
CSV escaping and waiver content schemas. Existing signature lists, individual
PDF downloads, streaming CSV endpoint and 500-file ZIP endpoint still work.
No signed PDF is regenerated, and no native signature or published version is
modified. A migration import never sends signing notifications.

The new background worker prepares large exports and imports outside Next.js
request time limits. Supabase is the durable queue; no Redis or second database
is required. The browser uploads files directly using scoped signed upload
tokens. It reads only CSV headers for mapping and receives 10 preview rows at a
time. Download links point to private storage instead of buffering ZIPs in the
browser.

## Deploy (not performed automatically)

1. Apply `supabase/migrations/0018_data_transfers.sql` after the existing
   migrations. It is additive and does not alter native records or RLS policies.
2. Deploy the Next.js application.
3. Run a **separate, continuously running Node.js 24 worker** from the same
   checkout using `npm ci` followed by `npm run data:worker`. Use a process
   supervisor/container that restarts it on failure. This is not a Vercel
   serverless request or daily cron: jobs need a running worker to progress.
4. The worker needs `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`. The app also uses its existing Supabase Auth
   configuration. No new credentials or email provider variables are required.
   Keep the service-role key on the server/worker only.
   For staging, use that project's URL, anon key
   (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and service-role key; set
   `NEXT_PUBLIC_APP_URL` to the protected staging origin and allow its Auth
   callback URL in the staging project's redirect settings. Do not use
   production database credentials or customer documents in these checks.
5. Give each worker at least 20 GB of scratch disk and enough RAM for a bounded
   20 MB CSV, a 50 MB document and metadata (2 GB recommended). Supabase project
   and bucket upload limits must allow the chosen files/archives; project plan
   limits still apply. A rejected storage upload marks the job failed and keeps
   its history. Increase the allowed size or export narrower date ranges.
6. Run the staging verification below before enabling customers to use it.

Use `npm run data:worker -- --once` to process at most one queued job and perform
due cleanup. It uses the configured database: do not run it against production
as a test. Multiple worker processes are safe; each claims a separate leased
job. Start with one worker to control storage load.

## Schema

- `data_jobs`: owner/organization, type, filters/mapping, state, summary,
  progress, confirmation, lease, result path and expiry.
- `data_job_files`: registered source filenames, expected sizes and private
  upload paths. Unique filenames per job avoid ambiguous associations.
- `data_import_items`: preview rows, original invalid values, warnings and
  final per-row results. Worker writes are leased and batch-transactional.
- `imported_waivers`: immutable historical archive with source provider,
  external ID, original signing date, imported-by/date, responses, imported
  source evidence, original PDF/image paths and SHA-256 hashes.
- `waiver_templates.import_key`: stable restore/import identity, unique per
  organization. Imported templates are new drafts using the existing content
  schema and settings. They must be reviewed and published through the existing
  workflow; an active subscription/trial is required to create these drafts.

All four new tables have RLS. Only the current organization owner may select
them through authenticated access. Anonymous access and all client writes are
revoked. Claim, staging, summary and transactional commit functions are granted
only to `service_role`; the commit function rechecks the current owner,
organization, template ownership and job lease.

## Routes

- `/data`: export controls, import wizard, transfer history/results.
- `/data/records`: paginated, searchable imported records.
- `/data/records/[id]`: source-labelled metadata and original downloads.
- `GET /api/data/jobs`: paginated owner history.
- `POST /api/data/jobs`: create an authorized transfer.
- `GET /api/data/jobs/[id]`: progress and paginated preview/results.
- `GET /api/data/jobs/[id]?download=1`: 10-minute private download redirect.
- `GET /api/data/jobs/[id]?errors=1`: streamed skipped/invalid-row CSV.
- `POST /api/data/jobs/[id]`: register uploads, request preview, explicitly
  confirm, retry a failed job or cancel an unstarted/failed transfer.

Every API operation re-resolves the authenticated owner. Browser-supplied
organization IDs are never used. Existing `/api/files/sign-url` serves the
original private PDFs/images after its existing organization-prefix check.
The data center requires authentication but does not add a subscription gate
to exports. Existing app billing redirect behavior is otherwise unchanged.

## Formats and matching

**Submission CSV:** UTF-8 with BOM and RFC4180 quoting, using the existing CSV
formula-escaping helper. Includes names, email, date of birth, original signing
date, source, IDs, hashes, serialized responses/evidence, plus a column for each
stored custom-response key. Phone is included when available. Native signing
channels, consent, guardian information and evidence are preserved in the
source-evidence JSON column. No unsupported tags or locations are invented.

**Signed PDF ZIP:** original stored PDFs, hash-checked, with safe names that
include the unique record ID. No PDF rendering occurs. Metadata-only imports
cannot produce a PDF; a PDF-only export containing them fails clearly instead
of silently omitting documents. Use a backup to preserve metadata-only records.

**Template JSON:** `format: flatwaiver-template`, `version: 1`, exported ID,
name, current draft/content and supported settings. Export also preserves the
version history as source material. Restore creates a new draft rather than
recreating original version IDs or native publishing events. Empty template
shells are included in backup exports but cannot be imported as valid content.

**Backup ZIP:** `manifest.json` (versioned, counts, filters and checksums),
`submissions.csv`, `records.ndjson`, `templates/*.json`, `waivers/*.pdf` and
available primary signature images in `signatures/`. NDJSON is the lossless
record source for restore: spreadsheet formula escaping does not affect it.
Native record metadata is retained as imported source evidence. Same-account
restore skips existing native IDs, imported record IDs and template IDs.
Restoring into another organization creates imported copies and draft templates,
with template associations resolved only inside that organization.

**Generic CSV import:** choose comma, semicolon or tab; map source columns to
participant fields, original signing date/IP/user agent, external ID, PDF/image
filename, a custom field, or Ignore. CSV date values must be `YYYY-MM-DD` or ISO
timestamps with timezone; locale-ambiguous dates are rejected. Provider names
are provenance labels, not undocumented proprietary parsers. No provider-specific
Smartwaiver layout has been invented.

**Historical PDFs:** one/multiple PDFs or PDF ZIPs, optionally alongside one
CSV. PNG/JPEG signature images are supported via the CSV filename mapping.
Matching uses an exact filename/path, or `external_id + .pdf` with a unique
exact match. Uncertain matches are errors. Unmatched PDFs appear as standalone
preview rows; unmatched images are counted and not imported. The preview must
be explicitly confirmed before final records or template drafts are created.
Use a separate CSV file alongside the PDF ZIP so the browser can show its
mapping controls.

## Integrity, retries and cleanup

- `provider + external_id` is the primary duplicate key. Without an external
  ID, a deterministic metadata/file checksum key detects identical records.
  Defaults to Skip existing; Import another copy adds a per-job/row identity.
- Final imported records are append-only and use unique object paths. Storage
  uploads never overwrite originals. Retries may reuse only identical bytes.
- Final records and item results commit together in batches of at most 100.
  A partially failed import retains committed records; Retry skips committed
  items. Preview staging cannot be changed after confirmation.
- ZIP extraction is sequential, rejects traversal, encrypted entries, symlinks,
  executables, duplicate names and expansion bombs. Entries are written to
  generated scratch filenames rather than archive paths. PDF/PNG/JPEG magic
  bytes are checked, and original files are hashed without alteration.
- Export results and staging expire after seven days. Worker cleanup runs
  hourly, with an extra two-hour grace period for signed upload tokens.
  It removes transfer objects and uncommitted orphan objects while preserving
  every original referenced by an immutable imported record. Aggregate job
  history remains; detailed error reports expire with staging.
- A crashed worker's lease expires after two minutes. After five interrupted
  attempts the job becomes Failed and offers Retry. Worker scratch directories
  are removed after each attempt; supervisors should also use disposable scratch
  storage to reclaim files left by forced process/host termination.

## Limits

- 100,000 records, 50,000 uploaded/ZIP entries, 250 CSV/custom columns per job.
- CSV: 20 MB; individual PDF/image: 50 MB; uploaded ZIP: 5 GB.
- Total expanded/exported content: 5 GB; ZIP expansion ratio: 200:1.
- Backup record NDJSON: 512 MB per archive; individual imported row: 200 KB.
- Preview/commit request batches also have a byte budget. Oversized invalid
  source rows are reported without echoing their full contents; large template
  previews show a summary and ask the owner to review the original JSON.
- Actual Supabase storage limits can be lower. Split large migrations/exports
  into date ranges or multiple batches when a limit is reached.
- This is a waiver-record backup, not a complete infrastructure clone. It does
  not restore Auth users, billing, team membership, integrations, original live
  slugs, check-ins, or photo/guardian-image attachments outside the signed PDF.
  Primary signature images are included; signed PDFs remain the archived source
  documents. It makes no claim to authenticate a previous provider's evidence.
- Live production database/storage behavior and deployment have not been
  exercised by local fixtures. The worker must be deployed alongside the app.

## Automated verification

```sh
npm run verify:data-transfers
npm run verify:csv-safety
npm run verify:billing-journey
npm run verify:account-boundaries
npm run lint
npm run build
git diff --check
```

The transfer suite uses real local PostgreSQL (PGlite), the actual migration and
the production worker, with a loopback object-store adapter. It never uses
production credentials. It checks CSV escaping/mapping, invalid rows, owner/RLS
isolation, immutability, 500 filtered rows and PDF downloads, full backup restore
into another organization, duplicate handling, 10,005-row imports, retries,
worker leases, ZIP security and cleanup. Browser checks used the real dashboard
component with isolated fixture responses at desktop and 390px mobile widths.
The built Next.js app was also checked without a session: both transfer GET
endpoints returned 401, a cross-origin POST returned 403, and `/data` redirected
to login. Authenticated production Storage transfers still need the staging
acceptance checks below.

## Staging acceptance flow

1. Apply the migration to a staging Supabase project; start the app and worker
   with that project's credentials. Sign in as an owner.
2. Export September records as CSV and PDF ZIP. Check a custom-answer column,
   an end-of-day September 30 signature and that an October 1 signature is absent.
3. Import a small real provider CSV plus its PDFs. Map columns, inspect preview
   matches and warnings, and confirm. Verify imported badges, source dates,
   unchanged PDF bytes and the downloaded error report.
4. Repeat the import with Skip existing; verify zero new duplicates. Repeat with
   Import another copy to confirm the explicit option.
5. Export a backup; restore it in a second staging organization. Verify draft
   templates, imported provenance, associations and original PDF checksums.
6. Sign in as a viewer and as another organization's owner; confirm private job,
   record and file requests are rejected/hidden.
7. Stop the worker during an import; restart after the lease expires. Confirm
   no duplicate final records and correct results. Test expiry cleanup on staging
  records only and verify archived original documents remain downloadable.

## Final readiness audit

- Worker SDK requests have deadlines (one minute for metadata, one hour for
  object transfers); each job attempt has a four-hour deadline. Heartbeats do
  not overlap and stop work on lease loss. Expired leases cannot be renewed.
  SIGINT/SIGTERM abort in-flight network work and persist a retryable error;
  hard termination recovers through the two-minute lease. Give the supervisor
  90 seconds to stop gracefully. Five interrupted attempts exhaust automatic
  recovery; an owner can explicitly retry an unexpired job. Transient polling
  and cleanup errors no longer terminate the worker loop.
- Cleanup first fences database commits and skips live leases. Seven-day
  artifacts are removed after a two-hour upload-token grace period. A stopped
  worker cannot clean storage; monitor failed jobs, oldest queued job, worker
  availability, disk space and storage usage. Use disposable scratch storage
  for host crashes and budget resources separately for each worker instance.
- Registration locks each job and limits total input bytes to 5 GiB, including
  multiple archives; actual downloads and cumulative ZIP expansion are also
  bounded. CSV/JSON inputs are capped at 20 MiB, documents at 50 MiB, archive
  entries at 50,000. Nested archives, links, traversal, encryption and excessive
  compression are rejected. Document type checks read eight bytes, not entire
  PDFs. CSV/NDJSON output is bounded while writing (512 MiB each). Template
  version history is loaded one version at a time and capped at 2 MiB per package.
- Archives stream between disk and private storage; archive bytes never pass
  through Next.js routes. Browser uploads go directly to signed private storage.
  These are standard uploads, not resumable TUS uploads: a failed browser upload
  requires restarting it. For large migrations use a stable connection and
  smaller batches. Supabase recommends resumable uploads above 6 MB; its project
  and bucket limits must permit the selected sizes. The 5 GiB application cap
  is a ceiling, not a guarantee that the hosting plan accepts every such upload.
  See https://supabase.com/docs/guides/storage/uploads/standard-uploads.
- Imported PDF/hash pairs cannot contain missing or invalid hashes. Original
  objects use create-only writes; retries reuse only identical bytes. Storage
  paths reject URL metacharacters and encoded traversal before service-role
  signing. This also hardens the shared download endpoint used by imports.
  Administrative/service-role access remains privileged; storage is not WORM.
  Magic-byte checks do not constitute malware scanning or authenticate a source
  provider's evidence. Original documents are downloaded, never rendered on the
  server as executable content.
- CSV explicitly includes record origin, original signing date and imported
  date. Native rows say “Signed through FlatWaiver”; imported rows say
  “Imported from [provider]”. A restored record retains the complete exported
  record in source evidence, including its prior import date and external ID.
  The new imported date identifies the current restore. New record/template IDs
  and draft template names are intentional; no native signing event is recreated.
- Backup restore rejects missing, unlisted, duplicate or hash/size-mismatched
  manifest files and mismatched counts. Tests compare all 504 restored records,
  custom fields, source metadata/timestamps, draft templates/settings, original
  and imported PDFs, and a signature image byte-for-byte. Exclusions above remain.

Run `npm run verify:data-transfer-security` in addition to the commands above.
It exercises the real API/auth handlers against isolated PostgreSQL RLS, with
forged organization IDs and known foreign job/record/storage identifiers. It
also covers encoded path attacks, immutable hash constraints, interrupted batch
retries, shutdown, exhausted leases, cleanup fencing, and stream/archive limits.
The local PGlite adapter serializes database calls: SQL uses row locks and
`SKIP LOCKED`, but confirm two independent worker processes against staging
Supabase PostgreSQL before production. Run a realistic large-file transfer in
that environment too; local tests do not certify 5 GiB network throughput.

No production migration, deployment, commit or push was performed by this audit.

Dependency advisory lookup still reports 16 existing advisories: 5 moderate,
10 high and 1 critical (the existing Next.js dependency). The newly added
transfer dependencies are not listed in that report. No unrelated dependency
upgrades were made. Use access-restricted staging with synthetic records and
resolve/review the existing critical/high advisories before public production
release. Application tests passing does not clear dependency advisories.
