# Kiosk Mode 2.0 staging acceptance

Status: release blocked pending live staging acceptance. No production data, migrations, commit, push or deployment was performed during this preparation.

## Environment discovery

Both `.env` and `.env.local` point to the same main FlatWaiver Supabase project, with the app origin set to localhost. No separately identified staging configuration or test accounts were found. The connected Supabase account lists the main active FlatWaiver project and an inactive Lead Engine project. The main project has no development branches. Neither project was treated as staging. Discovery read project/branch metadata only; no customer rows were read or changed.

Local Turnstile configuration uses Cloudflare's test-key family. This is suitable for deterministic automated acceptance, but does not verify a staging deployment. See https://developers.cloudflare.com/turnstile/troubleshooting/testing/ for matched site/secret test keys, failure and duplicate-token cases. A real staging widget additionally needs the staging hostname allowed. Use real production keys only for an approved production deployment. Never enable the development signing bypass in staging acceptance.

Needed to complete acceptance: an explicitly identified isolated staging Supabase project, a running staging app with this code, owner/staff test accounts plus a second organization, published single/group test waivers, usable test subscriptions, private storage buckets and staging-only Turnstile configuration. Configure secrets securely rather than putting credentials in this report. Use synthetic participant data and controlled test recipients/webhooks.

## Results and limits

Local regression reruns passed kiosk settings/privacy restrictions, group validation/route/PDF/CSV/history/RLS tests, shared-device, DOB validation, signature input, team access and account boundaries. Real Chromium reruns passed one adult, two adults and adult plus three children; explicit signatures, DOB/guardian payloads, drawn-ink retention, removal, validation focus, French, desktop/tablet/mobile, back navigation, standard fields, failed-response data retention, reset confirmation, idle warning/continue/expiry, success reset and no signing PII in browser storage. Browser signing and Turnstile endpoints were mocked. Route/storage tests use controlled doubles and migration/RLS tests use local PGlite; these are not live Supabase staging acceptance.

The responsive-contract suite fails at `scripts/verify-responsive-contracts.mjs:37`: an expected `overflow-x-hidden overflow-y-auto` string is absent from the unchanged waiver editor. The kiosk's actual browser viewport checks pass. This known unrelated source assertion was not changed or suppressed.

The default lint traversal has a separate inaccessible `output/font-tools` artifact problem; application/scripts lint is the usable alternative.

Final TypeScript, application/scripts lint and production build passed. Data-transfer and data-transfer-security reruns passed, including original evidence exports, restore, tenant boundaries and retry fencing. The public-signing-billing test initially failed because its VM dependency map did not include the new kiosk-settings module. `scripts/verify-public-signing-billing.mjs` now loads the actual settings module and constants; the rerun and targeted lint passed. Billing authorization behavior was not changed. This test harness and this acceptance report are the only files changed during acceptance preparation.

Not tested live: Settings → Kiosk save/read persistence, owner/staff permissions and two-organization isolation; actual signature/photo uploads; generated/stored PDF retrieval and saved submission records; Turnstile widget/siteverify integration; applied migration history; reliable retry/idempotency across real network/storage failures; standard-link submissions on staging. No pass is claimed for these checks.

## Staging acceptance procedure

1. Confirm the app origin, Supabase project reference and all server credentials identify staging. Verify no production billing/email/webhook destinations are active for test submissions.
2. Inspect staging migration history through the connected project/normal CLI workflow. Compare the complete repository migration sequence through 0027. Confirm 0026 group columns, publication RPC, validation trigger and participant search index, and 0027's DOB-aware `validate_group_waiver` function. Check actual schema as well as history. Participant DOB is a JSON property, not a standalone column. Apply missing migrations only to the confirmed staging project through the normal reviewed process. Kiosk preferences require no additional migration.
3. Confirm `signatures`, `signed-pdfs` and `uploads` remain private with the expected organization-prefixed paths. Use owner A, staff A and owner B in separate browser sessions. Save different welcome/visibility settings; reload/new-session verify persistence. Staff save must be denied. Each organization must see only its own settings/templates.
4. Use matched Cloudflare test keys on staging to exercise actual widget and siteverify requests. Test successful, failed and duplicate-token validation without intercepting services. Separately manually smoke-test the real staging widget/allowed hostname configuration. Confirm empty/expired tokens fail closed and retries obtain fresh tokens.
5. Submit one adult, two adults and one adult plus three children through real `/kiosk/<slug>` pages. Record each returned signed-waiver ID, participant order and DOB, distinct evidence paths, one authoritative row and one stored PDF per submission. Download originals through the authenticated UI and inspect all participant/guardian evidence and consent/version pins. Do not regenerate historical PDFs.
6. For the family, independently act on all seven signatures. Reuse guardian metadata via three explicit child opt-ins. Check that each guardian canvas starts unsigned and each stored guardian evidence path belongs to its own participant. Identical typed guardian image bytes can be legitimate when the same parent explicitly signs each child; independent action and correct path association, not differing image hashes, are the acceptance criterion. Change shared guardian identity and confirm every affected guardian must resign. Test a different guardian for one child and middle removal/readdition.
7. Exercise missing/future DOB, missing signatures/guardian relationship, consent, required custom/medical/photo fields, Back and review editing. Verify focus identifies the incomplete person. Check clear cancellation/confirmation, warning at 150 seconds, continuation, reset at 180 seconds and success reset after five seconds. Inspect browser storage for synthetic PII. Test actual tablet/browser refresh warning behavior.
8. Simulate a request interruption/response loss on synthetic staging submissions. Retry through the UI with the same submission ID and fresh challenge token, then check exactly one stored record and PDF. Inspect upload failure handling and existing idempotency, never editing/deleting append-only evidence as cleanup.
9. Repeat single/group signing through standard `/w/<slug>` links; compare required fields and records/PDFs. Check staff detail views, existing historical records, CSV/PDF exports and Front Desk group check-in.
10. Record IDs, role/organization assertions, screenshots, Turnstile results, migration history and original PDF verification. Obtain release approval only after all live checks pass. Physical touch hardware, Safari, screen readers and real-user completion-time measurements remain separate manual acceptance items.

## Deployment checklist (approval required)

- Complete and sign off the live acceptance matrix; resolve or explicitly disposition the known unrelated responsive assertion.
- Confirm production migration history/schema through 0027 using a read-only review. Any missing production migration requires separate approval and the existing reviewed additive migration process before DOB writes. Kiosk itself has no SQL migration.
- Record the approved previous build/revision and environment settings; preserve original evidence and normal backups.
- Verify production Turnstile keys/hostname, service-role server boundary, private buckets, billing gates, request size/time limits and disabled development seed/bypass flags.
- Commit/push/deploy only after explicit approval, then smoke-test kiosk and standard signing with an approved synthetic test organization and monitor signing/storage/PDF errors and retries.

## Rollback

Restore the immediately previous known-good pre-Kiosk-2.0 app build and its environment configuration. Keep additive group/DOB migrations and `branding.kiosk` JSON; previous code ignores kiosk preferences. Do not roll back below participant-DOB support without a separate compatibility review. Never delete/rewrite signed rows, template versions, participant evidence or stored PDFs. Confirm historical downloads/exports and standard signing still work after app rollback. Reconcile any interrupted submission using existing idempotency/evidence records, then repeat the three signing smoke tests before reopening kiosk use.
