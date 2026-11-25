# QR check-in architecture and release guide

Implementation branch: `feature/qr-checkin-2026-11-25`. Based on `work/source-snapshot-2026-11-18` because the existing group/kiosk source is a prerequisite. Review the QR diff against that branch. Do not merge the snapshot or deploy production implicitly.

## Visitor and staff flow

After the immutable signature/PDF is stored, the server commits the signing record and SHA-256 receipt proof in one transaction. A 32-byte browser-generated receipt is sent only in the POST body. Public confirmation uses that proof to retrieve opaque QR codes labeled by participant number, without names, email, database IDs or storage paths. Numbers follow the original form order. Public pages cannot verify a QR or retrieve a signed record. Browser session storage supports reload/retry; kiosk receipts stay in memory and clear on Next guest or after 60 seconds. If storage is blocked, confirmation stays inline. After a browser session ends, venue staff can retrieve existing passes through Front Desk.

Each immutable participant array index receives one pass, including a minor represented by a guardian. A guardian has no extra attendance pass unless also listed as a participant. Old single-signature records use participant index 0. Staff issuance is opt-in, idempotent, organization-scoped and does not retroactively email old customers.

QR payloads are `FWP1.<opaque HMAC-SHA256 value>`, derived from a random per-pass nonce and a server-only 32-byte key. The database stores a token hash and nonce, never the QR token. Unique constraints prevent multiple passes per signed participant. Keep `QR_PASS_SECRET` stable and backed up: changing it makes existing passes unavailable for re-delivery. It is not a routine rotation key; any replacement requires a separately reviewed reissue plan. Individual owner/admin revocation blocks the pass and operational check-in without altering immutable evidence.

## Attendance and authorization

Migration `0031_qr_checkin.sql` adds operational pass, receipt, delivery and rate-limit tables, plus participant and visit columns on existing check-ins. Existing check-ins remain valid. No historical migration, template version or stored PDF is edited.

Default attendance is one row per participant per UTC calendar day (`day:YYYY-MM-DD`), matching existing Front Desk semantics. An optional shared `session:<reference>` allows another visit on the same day. There is no invented pass expiration: the server uses the current template's existing `expiry_months` policy, including the existing UTC JavaScript month-overflow behavior. An expired, revoked or incomplete waiver cannot be checked in with the new atomic operation. Flags remain prominent warnings for staff review.

An advisory transaction lock on the immutable signing ID serializes QR scans, manual group check-in, undo and revocation. A unique participant/visit index provides a second concurrency guard. Manual group entry adds only missing participants; partial group scans do not mark the entire group checked in. Undo affects operational attendance only. Legacy null-participant rows cover the whole group for their UTC day.

Authenticated APIs resolve staff identity from Auth and the live profile, then enforce organization and role again in database functions. Viewers cannot verify, issue, revoke or write attendance. Owners/admins can revoke. Functions and raw token metadata are service-only; RLS exposes safe pass metadata only to organization staff. Authenticated clients cannot write check-ins directly. API bodies are limited to 4 KB; distributed per-staff and receipt-IP rate limits use keyed hashes. Tokens are excluded from URLs, logs and analytics events. Public signing already suppresses analytics; scanner/pass regions are marked private and masked for session replay. Audit entries contain actor, target and action/status/visit, never QR secrets. New dependent rows cascade with the existing signed-record deletion lifecycle; immutability policies remain authoritative.

## Transactional email

New signer receipts with email enqueue delivery atomically. The existing Resend policy applies: staging sends no application email, missing credentials leave delivery pending, and no marketing consent is inferred. Per-participant PNGs contain only opaque codes. Signing confirmation never waits for the new email operation. A five-minute database lease and stable Resend idempotency key prevent simultaneous/retried sends from generating duplicate notifications. Pending jobs retry through `/api/cron/waiver-passes`, authenticated with the existing `CRON_SECRET`. Ambiguous sends stop automatically after 23 hours, within Resend's 24-hour idempotency window, and require operator review; do not reset these jobs blindly.

The supplied five-minute Vercel cron requires a hosting plan supporting that frequency. Confirm the existing plan before merging/releasing; the connected Vercel account returned 403 during read-only plan inspection, so plan support is unverified. An existing scheduler may invoke the same authenticated endpoint instead; remove the five-minute Vercel entry if using that alternative. No additional paid email or QR service is introduced. Monitor pending/attention counts and queue age. The worker handles at most 20 jobs per invocation and spaces sends for the existing provider limit.

## Release and rollback

1. Review prerequisite source and this feature separately. Back up the database through the normal operational process.
2. Keep `QR_CHECKIN_ENABLED=false`. Apply only the forward migration after the normal migration review. Existing feature-off signing and Front Desk remain compatible.
3. Configure a server-only `QR_PASS_SECRET` generated with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Configure the existing Resend and cron secrets in the appropriate environment; never prefix this key with `NEXT_PUBLIC_`.
4. Deploy to an isolated preview/local environment, enable the flag and verify the documented tests. No production database or deployment was changed by this implementation.
5. After approval, enable in the intended environment and smoke-test a synthetic signer, saved pass, authorized scan, duplicate visit, group/minor and cross-organization rejection. Confirm queue delivery and camera permissions on actual staff devices.
6. To roll back, disable the flag and deploy the previous compatible source. Retain operational data and migration columns; do not drop tables or regenerate signed evidence. Stop the QR email scheduler if needed. Previous manual check-in behavior is restored when the flag is off; existing signed records remain available.

## Local verification

Use an isolated Supabase project (`supabase/config.jsonc`, project `qr-checkin`, loopback ports 55320–55329), never a linked hosted project. Run `npx supabase start`; configure `.env.local` with its local URL/keys, `QR_CHECKIN_ENABLED=true`, a local random QR key, `ALLOW_DEV_SEED=true` and `FLATWAIVER_ENV=staging`. For production-build verification, configure the official Cloudflare always-pass test secret and site key, run `npm run build`, then `npm run start -- -p 3020`. The documented test credentials are at https://developers.cloudflare.com/turnstile/troubleshooting/testing/; never use them on a public production deployment. A dev server is also supported.

`node scripts/verify-qr-database.mjs` refuses non-loopback Supabase URLs and creates synthetic append-only fixtures and local Auth users. It writes ignored `tmp-qr-fixture.json` for the browser test. Run `PLAYWRIGHT_MODULE=<installed-playwright-path> node scripts/verify-qr-browser.mjs` with Chromium installed. The browser test supplies the official Turnstile dummy widget token and a QR-image camera stream; real UI, signature rendering, app APIs, local Auth, PostgreSQL and private Storage are used. Camera hardware/device compatibility and live Resend delivery require a release smoke test; simulated camera decoding and provider failure/idempotency tests do not establish those external guarantees.

Test results and screenshots are recorded in `validation.md` after verification completes.

## Implementation map

- Database: `supabase/migrations/0031_qr_checkin.sql`; isolated test stack: `supabase/config.jsonc`.
- Token/proof, authorization and email: `src/lib/qr-pass.ts`, `qr-http.ts`, `qr-pass-mail.ts`, and the transactional sender in `src/lib/email.ts`.
- APIs: `src/app/api/checkin/{verify,passes,revoke}/route.ts`, `api/waiver-passes/receipt/route.ts`, `api/cron/waiver-passes/route.ts`, and signing transaction integration in `api/sign/[slug]/route.ts`.
- UI: `src/components/waiver-passes.tsx`, `qr-checkin-scanner.tsx`, `signing-form.tsx`; public signing/kiosk/confirmation pages and existing Front Desk page/actions.
- Configuration: `.env.example`, default-off feature flag, `vercel.json` retry schedule, pinned `jsqr` dependency and ignored local test fixtures.
- Tests: `scripts/verify-qr-{database,browser,email}.mjs`; three existing signing/privacy test harnesses updated to retain their feature-off regression coverage. Screenshots and detailed results are in `validation.md`.
