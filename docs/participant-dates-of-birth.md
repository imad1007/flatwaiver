# Participant dates of birth

## Storage and compatibility

New group submissions require `participants[].dateOfBirth` as a real `YYYY-MM-DD` calendar date, no later than the current UTC date. Each entry is stored in `signed_waivers.participants` as `date_of_birth`, alongside that participant's name, signatures and guardian information. Dates remain strings; display does not convert them through a timezone.

Participant 1 is already the primary signer in this model. Its DOB supplies `signer_dob` and any existing template fields of type `date_of_birth`. Group signing therefore hides those duplicate top-level inputs. Other custom fields still apply to the primary participant. Single signing retains its existing fields and validation. Guardian requirements continue to use the existing minor selection; this change does not introduce new age-based admission rules.

The count selector retains each hidden participant's name, DOB and signatures together. Only the selected entries are submitted. Clearing or resetting the kiosk clears DOBs as well.

Historical group records may have no `date_of_birth`. Detail views display “Not recorded”; they never infer a participant DOB from the primary signer's field. Historical rows and PDFs are not changed or regenerated.

## Migration and rollout

Apply `supabase/migrations/0027_participant_dates_of_birth.sql` **before deploying the application changes**. Migration 0026 is a prerequisite. The new migration replaces the existing INSERT validation function to allow the additional JSON key and validate dates when supplied. Missing/null dates remain accepted by the database for legacy writers. New application submissions require every DOB.

No column, table, RLS, publishing RPC or storage policy is changed. The migration does not update historical evidence. Existing organization checks, private signature paths, group size limits, guardian validation and primary-participant consistency checks remain in place. The function retains security-invoker execution and its existing restricted grants.

The migration was tested in local PostgreSQL via PGlite, including a group record inserted before migration, unchanged evidence after migration, new DOB persistence, invalid dates, tenant isolation and append-only protections. It has not been applied to production. Apply it first, then deploy, and refresh any group forms already open in browser/kiosk tabs so the required fields appear. The expanded database contract also remains compatible with the previous application version if an application rollback is needed.

## Retrieval and exports

- `/signatures/[id]`: each participant's name and DOB appear together.
- `/data/records/[id]`: restored/imported participant DOBs appear when present in source evidence.
- New signed PDFs show DOB in the corresponding participant signature block. Duplicate primary DOB fields are omitted from the PDF's contact section; the submitted primary field snapshot remains stored.
- Both signature CSV and data-transfer CSV retain DOB inside `participants_json`, paired with the participant name. Existing CSV column order is unchanged.
- Full backup/restore retains participant DOB alongside signature evidence; original PDFs remain byte-for-byte preserved.
- Existing API participant responses and signature-created webhooks include the additive `date_of_birth` property. Historical API participant entries return null for missing DOB.
- Dashboard lists and admin customer summaries do not expose a new DOB column; the existing full record detail screens show it.

## Manual UI checks

1. Apply migration 0027 in the test database. In `/waivers`, open a waiver, enable multiple participants and publish (or use an existing published group waiver). Test a template that already has a required date-of-birth field.
2. Open its Share signing link (`/w/[slug]`). Choose two participants, enter distinct names and DOBs, and provide the existing signatures/consent. There should be one DOB inside each participant section and no extra top-level DOB input.
3. Change the count 2 → 4 → 2 → 4. Confirm every name, DOB and signature stays paired. Reduce to two and submit: only those two participants should be stored.
4. Leave a DOB empty and try a future date. Confirm submission fails for the affected participant. Test a valid leap-day DOB. Also test a minor with the normal guardian fields and signature.
5. Open the completed record in `/signatures`, then download its PDF. Check the participant name/DOB pairs. Export CSV and inspect `participants_json`.
6. Use kiosk mode (`/kiosk/[slug]`) on a phone-sized viewport/tablet. Check the date picker and absence of horizontal overflow. Complete a submission or use Clear form; the next participant group must start with empty DOBs.
7. Open an older group record without DOBs: expect “Not recorded” and its unchanged original PDF. Test a single-participant waiver with its existing DOB field and one without a DOB field.
8. Through `/data`, export and restore a backup into a test organization. Open its imported record and compare the name/DOB pairs and original PDF. Use only test records for this exercise.

## Automated coverage

`npm run verify:group-waivers` covers per-participant dates, missing/invalid/future values, leap years, counts 1/2/10, actual add/hide/restore handlers, kiosk state reset, single/group form rendering, request persistence, primary DOB derivation, PDF rendering, CSV JSON, API/webhook fields, native/imported detail views and migration compatibility.

`npm run verify:data-transfers` covers participant DOB preservation through full export/restore, along with existing storage and tenant-boundary checks. `verify:signing-validation` and `verify:api-pagination` remain applicable regression checks.

## Files changed

- Form: `src/components/group-participants.tsx`, `src/components/signing-form.tsx`.
- Validation/storage: `src/lib/group-signing.ts`, `src/lib/types.ts`, `src/app/api/sign/[slug]/route.ts`, migration `0027_participant_dates_of_birth.sql`.
- Display/PDF: `src/app/(app)/signatures/[id]/page.tsx`, `src/app/(app)/data/records/[id]/page.tsx`, `src/lib/pdf/waiver-pdf.tsx`.
- API/webhooks: `src/lib/public-api.ts`, `src/lib/webhooks.ts`.
- Translations: `src/lib/signer-language.ts`, `src/lib/signer-translations.ts`.
- Tests: `scripts/verify-group-waivers.mjs`, `scripts/verify-group-sign-route.mjs`, `scripts/verify-group-participants-ui.mjs`, `scripts/verify-group-record-view.mjs`, `scripts/verify-data-transfers.mjs`.
- Documentation: this file.
