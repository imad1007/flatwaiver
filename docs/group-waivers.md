# Group waivers

Implemented October 7, 2026. The production migration must be applied separately.

## Behavior and storage

The waiver editor has an optional **Group / multiple participant signing** switch, off by default. Save and publish a new version to change public signing. Draft recovery and translation preserve the setting. Published versions freeze the setting; group-enabled versions include it in their content hash. Existing single-waiver content hashes retain their original format.

The public link and kiosk support 1–10 ordered participants, using the existing drawn/typed signature component. Reducing the count hides and disables sections while retaining their names and signatures for the current session. Only the selected count is submitted. Kiosk reset clears the group. All ten existing interface languages have the new labels, including English and French.

Custom fields, contact email/DOB, and photo remain primary participant/contact information (Participant 1). Each participant has their own name, signature, minor status, and guardian information/signature where applicable. The published minor policy still applies. The original top-level signer columns describe Participant 1, including their guardian if they are a minor.

Participants live in a JSON array on the existing append-only `signed_waivers` row. Array order is participant order. Names, minor status, guardian details, and private signature paths are committed atomically with the completion record. This avoids a separately writable child table and inherits existing organization RLS. Old records have null participants and require no conversion.

## Migration and security

Apply `supabase/migrations/0026_group_waivers.sql` after migration 0025. It adds:

- `template_versions.group_signing_enabled`, default false.
- Nullable `signed_waivers.participants`.
- An eight-argument, security-invoker publish RPC; older overloads remain available.
- An insert trigger enforcing the published mode, 1–10 participants, exact participant shape, names, minor/guardian policy, signature path ownership/order, primary participant consistency, and version/template/org association.
- A generated participant-name search column and trigram index.

Existing version and signed-record immutability triggers remain in force. There are no new anonymous read/write policies. Only the server service-role signing handler writes completions. Staff reads use the authenticated SSR client and existing tenant RLS; signature previews use org-prefix-checked, 10-minute private URLs.

The API checks billing availability, participant count and array agreement, strict participant schemas, every signature, guardian requirements, and primary/group consistency. Group PNG validation checks size, dimensions, canonical base64, required chunks, and CRCs. Request-body bytes are bounded before JSON parsing. Existing Turnstile, rate limiting, idempotency, cleanup, photo policy, and custom-field validation remain active. React escapes participant names. Public API/webhook additions expose participant names and minor status, without private image paths.

## PDFs, exports, and records

The PDF contains numbered participant signature cards and guardian signatures, plus the existing clauses, custom responses, consent snapshot, timestamp, and evidence/hash page. Each card stays together across page breaks. The existing double-render SHA-256 process remains; stored historical PDFs are never regenerated. Staff details show the group count, every name, and signature previews. Staff search and matching CSV/PDF/transfer filters include participant names.

Both CSV paths retain one row per completed waiver and add `participant_count`, `participant_names` (ordered JSON names), and `participants_json` (structured evidence). Existing columns, including phone, remain in their original positions. Single waivers report count 1. PDF ZIP exports download the already-stored group PDF. Full backups include individual participant and guardian images; restore keeps groups as imported evidence, preserves original metadata, and stores restored images under the destination org's private import prefix. Restored group metadata remains available in CSV and imported-record views.

## Main implementation files

- `src/components/waiver-editor.tsx`, `src/lib/waiver-schema.ts`, `src/app/(app)/waivers/actions.ts`, `src/lib/canonical.ts`: draft, publish, version hash, preview.
- `src/components/group-participants.tsx`, `src/components/signing-form.tsx`, `src/components/signature-canvas.tsx`: participant entry, retained hidden values, signatures, kiosk reset.
- `src/lib/group-signing.ts`, `src/app/api/sign/[slug]/route.ts`: validation, storage, atomic completion.
- `src/lib/pdf/waiver-pdf.tsx`: group signature and evidence sections.
- `src/app/(app)/signatures/`, `src/app/(app)/data/records/[id]/page.tsx`: staff views and search.
- `src/app/api/signatures/`, `src/lib/data-transfer-core.mjs`, `scripts/lib/data-transfer-worker.mjs`: CSV, PDF ZIP filtering, backup/restore.
- `src/lib/signer-language.ts`, `src/lib/signer-translations.ts`: interface translations.
- `src/lib/public-api.ts`, `src/lib/webhooks.ts`, `src/app/api/v1/signatures/`: additive group metadata.

## Verification

- `npm run verify:group-waivers`: passes. Four new scripts cover validation and PNG bounds; actual POST storage/PDF input/billing/rate-limit behavior; actual UI handlers for count changes, French errors and reset; actual completed-record SSR, XSS escaping, prefix defense, and restored-group CSV.
- The database tests apply the real schema, RLS, publishing migrations, group migration, and trigram index to PGlite PostgreSQL. They exercise 1/2/10 participants, invalid counts/shapes/names, disabled versions, cross-org association, tenant/anon visibility, client write denial, search, immutable rows, and publishing.
- Single, 1-, 2-, and 10-participant PDFs render successfully. The 10-person PDF was rendered to four page images and visually inspected; text extraction confirms all ten names. Signature cards stay together and the evidence page is intact.
- Production build and TypeScript pass. Lint passes with `output/**` and temporary QA files excluded; the existing untracked output tree otherwise causes an EPERM traversal error.
- All other package verification commands pass except two baseline failures: `verify:responsive` expects `overflow-x-hidden overflow-y-auto` in the editor, and `verify:marketing-pricing` expects a different climbing article modification date. Both assertions also fail against unchanged HEAD files.
- Phone-export, signer-language SSR/catalog, and signer-language publishing checks pass separately.
- Updated data-transfer integration tests pass, including group image backup/restore into another org, 500-row CSV/PDF ZIP, a 10,005-row import, tenant boundaries, resume, and cleanup. Transfer security tests pass.
- The live `verify:sign-flow` script was not run: it appends records to a connected demo database. The new submission-handler tests run locally without production writes.

## Deployment and manual checks

1. Apply migration 0026 through the project's normal Supabase migration process **before deploying the app and transfer worker**. The generated search column/index may take time on large archives; test on staging first.
2. Deploy the app and transfer worker together. No new environment variables or app dependencies are required.
3. Enable group signing on a staging template, save, and publish. Confirm an off-version remains single-person and previously generated PDFs are unchanged.
4. On real phones/tablets/desktops, test drawn and typed signatures, 1/2/10 people, 4→2→4 retention, minors/guardians, French, kiosk inactivity/reset, interrupted submission/retry, PDF downloads, name searches, CSV, ZIP, and backup restore.
5. Confirm deployed hosting request-size/time limits permit a realistic 10-person submission, and test storage failure/retry and Turnstile with staging credentials. The local body bound does not override a hosting provider's limit.

Physical touch/device testing and deployed end-to-end signing remain manual checks; automated UI tests exercise state/handlers and SSR, not a real browser or pointer device.
