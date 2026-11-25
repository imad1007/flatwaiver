# Verification evidence

Verified locally on 2026-11-25. No hosted database, production deployment, customer records or analytics settings were changed.

## Checks

- `npm run build` and final `npm run build -- --webpack`: passed (Next.js 16.2.10 production build, TypeScript and all 83 static pages).
- `npx tsc --noEmit --pretty false`: passed during implementation; production builds also run TypeScript.
- `npm run lint -- --ignore-pattern 'output/**'`: passed. Unfiltered `npm run lint` reports 11 inherited `no-require-imports` errors in `output/check-admin-preview.cjs` and `output/delete-requested-accounts.cjs`; these generated artifacts are outside this change. Source/scripts lint and changed-file lint passed.
- Fresh isolated `supabase db reset --local --yes`: applied migrations 0001–0031 successfully. New tests use local Auth, PostgREST, PostgreSQL and private Storage, not an in-memory database substitute.
- `npm run verify:qr:database`: passed. Stable issuance; atomic receipt binding; duplicate commit cannot replace receipt; old signed record issuance; wrong receipt, viewer and cross-tenant rejection; anon RPC/table denial; authenticated hash/nonce/direct check-in restrictions; 20 simultaneous scans yield one participant visit; repeat custom sessions; owner-only revocation; group and minor evidence; missing guardian attention; existing expiry; immutable evidence; legacy attendance; group undo; rate limits; one concurrent email lease; 23-hour attention cutoff.
- `npm run verify:qr`: passed. Transactional attachments, stable provider idempotency key, provider rejection, durable retry, sent state and delivery-lease exclusion. The provider is mocked for these unit tests; no live email was sent.
- Existing `verify:group-waivers`, `verify:public-signing-billing`, `verify:billing-lifecycle`, `verify:team-access`, `verify:account-boundaries`, `verify:signing-validation`, `verify:signature-input`, `verify:kiosk`, `verify:shared-device`, `verify:migration-safety` and `verify:api-pagination`: passed.
- `git diff --check`: passed.

## Browser → API → data → UI

`verify:qr:browser` passed against a local production build, with official Cloudflare test credentials. All app APIs and local data services were real. Only the Turnstile widget callback and camera device stream are controlled test inputs.

| Boundary | Evidence |
|---|---|
| Signing UI → signing API | Filled name, email, signature and consent; POST returned 200; repeated identical submission returned duplicate success |
| API → immutable data | Exactly one signed row; private PDF present; final PDF bytes match the persisted SHA-256 |
| Signing → confirmation | Individual opaque QR and successful PNG download rendered at 1280 and 390 px; reload recovered the pass |
| Confirmation privacy | Receipt response contains only participant number, opaque code and revocation flag; unknown receipt gets 404; anonymous staff verification gets 401 |
| Camera → verification | The actual downloaded-pass PNG supplied as a video stream went through the actual jsQR decoder; staff saw the correct participant and waiver; camera tracks stopped after detection |
| Verification → attendance | Explicit Check In persisted one participant/day row; repeated scan/check-in returned Already checked in without another row |
| Manual Front Desk | Participant search, Undo, manual Check in and existing QR retrieval worked; reissuance returned the same code |
| Access control | Viewer gets 403; another organization gets generic Invalid QR and cannot issue passes; foreign Origin is rejected |
| Failure handling | Denied camera, unsupported camera, malformed code and aborted network request all showed feedback; manual verification/search remained available |
| Camera lifecycle | Closing before permission resolves stops a subsequently granted stream |
| Kiosk privacy | Pass rendered after real signing; no pass receipt entered session storage; pass disappeared after the one-minute reset |
| Appearance | Light/dark scanner layouts captured and visually reviewed at desktop/mobile widths |

## Review images

- [Confirmation, desktop](screenshots/confirmation-desktop.png)
- [Confirmation, mobile](screenshots/confirmation-mobile.png)
- [Scanner, desktop](screenshots/scanner-desktop.png)
- [Scanner, mobile](screenshots/scanner-mobile.png)
- [Scanner, dark desktop](screenshots/scanner-dark-desktop.png)
- [Scanner, dark mobile](screenshots/scanner-dark-mobile.png)

Images contain only synthetic local test identities and passes. Physical cameras on the customer's actual devices and accepted delivery through live Resend remain release smoke tests. The user confirmed Vercel Hobby through the deployment error. The QR cron was corrected to once daily (09:30 UTC); a configuration regression test verifies all deployed crons are daily. Initial emails remain immediate, but failed-send recovery is daily and ambiguous jobs older than 23 hours require operator review. See README.md for these recovery limits and rollout.

Hobby deployment correction: `npm run verify:qr` passes with a regression assertion rejecting non-daily cron expressions. No application code or database migration changed in this follow-up.
