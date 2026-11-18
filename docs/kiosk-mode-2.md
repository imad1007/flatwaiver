# Kiosk Mode 2.0

Implemented locally, October 2026. No production migration, commit, push or deployment was performed.

## Experience and safety

The existing SigningForm and signing endpoint remain authoritative. Kiosk mode adds read/consent, people/details and review stages, with mounted participant cards so navigation retains draft information. Standard signing links retain their original layout and payload. Published content, evidence creation, stored PDFs, exports and webhook behavior are unchanged.

The improvements go beyond splitting the form: compact explicit typed-signature buttons avoid retyping names, stable participant slots preserve name/DOB/signature pairing on middle removal, and family guardian details can be entered once. Each child must explicitly opt into reuse and independently provide both required participant and guardian signatures. Changing a participant identity/DOB clears that person's draft signatures; changing shared guardian details clears guardian signatures for children using them. Nothing auto-signs when a name is entered.

Participant validation opens the incomplete card, reports an inline error and focuses the relevant input/signature area. Native required fields remain validated. Required photo, conditional medical questions, exact electronic consent and server validation remain enforced.

Clear/remove use modal confirmations with keyboard focus containment. An inactivity warning appears after 150 seconds; Continue signing renews the deadline. After 180 seconds of inactivity the form clears. Successful signing clears after five seconds. Reset removes names, DOBs, guardian details, custom answers, photo, draft signatures, consent, challenge token and submission ID. Personal signing data remains in component memory, never local/session storage. Photo processing and submission pause idle expiry to avoid clearing an in-flight operation. A native before-unload warning protects dirty kiosk forms where the browser supports it.

The guided interface includes large touch controls, progress, participant summaries and English/French translations. Custom waiver content retains its existing translation behavior.

## Owner customization and database instructions

Open Settings → Kiosk (`/settings/kiosk`) as an owner. Set English/French welcome text and instructions and choose eligible optional questions to hide for each published template. Other roles can read settings but cannot save them.

No new migration is required. Preferences are stored in `organizations.branding.kiosk`, preserving other branding keys. Optional-field permissions are evaluated against the current published version each time: required, flagged, name/DOB, checkbox, initials and conditional medical fields cannot be hidden. Standard links ignore these preferences. Field requirements still require publishing a new immutable version through the existing editor.

Existing group signing and DOB functionality assumes the project's existing migrations 0026 and 0027 are already installed. Do not reapply them blindly. This implementation applies no SQL and changes neither historical signed records nor template versions. Reverting to the previous app version leaves preferences stored but ignored.

## Reproducible workflow measurements

Real Chromium exercised the preserved standard layout as a baseline and the improved kiosk layout using the same fixture names/DOBs. All signature actions are explicit. The fixture omits irrelevant optional questions and uses a required acknowledgment.

| Scenario | Typed field entries before → after | Typed characters before → after | Required signature actions | Form height before → active kiosk section |
| --- | --- | --- | --- | --- |
| One adult | 3 → 2 | 32 → 21 | 1 → 1 | 1269 → 1033 px |
| Two adults | 6 → 4 | 56 → 38 | 2 → 2 | 1770 → 1093 px |
| Adult + three children | 21 → 9 | 188 → 78 | 7 → 7 | 3900 → 1443 px |

Family guardian metadata changes from six typed fields to one typed relationship plus explicit primary-name copy and three child opt-ins. This reduces family typing entries by 57% and characters by 59%. Guided navigation adds Continue interactions; it does not reduce every click.

Automated entry durations were approximately 73/143/723 ms before and 98/160/1625 ms after. These are development-server automation timings, including different assertions and control interactions, not human signing times. They do not demonstrate a wall-clock speed improvement. Human timed usability testing and live submission latency remain unmeasured. The measured typing and visible height reductions target confirmed repetition/scrolling bottlenecks. Request-local public lookup caching and memoized participant rendering avoid redundant lookups/renders without changing submission reliability.

## Files

- Signing UI: `src/components/signing-form.tsx`, `group-participants.tsx`, `signature-canvas.tsx`, `kiosk-dialog.tsx`.
- Owner settings: `src/app/(app)/settings/kiosk/page.tsx`, `actions.ts`, `src/components/kiosk-settings-form.tsx`, `settings-tabs.tsx`.
- Kiosk wiring/settings/translations/privacy: `src/app/kiosk/[slug]/page.tsx`, `src/lib/public-waiver.ts`, `types.ts`, `kiosk-settings.ts`, `kiosk-privacy.ts`, `kiosk-translations.ts`, `signer-language.ts`.
- Tests: `scripts/verify-kiosk.mjs`, `verify-kiosk-browser.mjs`, updated `verify-group-participants-ui.mjs`; commands in `package.json`.

The existing Signatures placeholder change and unrelated output/font-tools artifacts were left alone.

## Verification

Passed: TypeScript (`npx tsc --noEmit`), production build (`npm run build`), application/scripts lint (`npx eslint src scripts`), group-waivers, kiosk settings/privacy, shared-device, signing-validation, signature-input, team-access, account-boundaries, data-transfer-security and data-transfers suites. Group suites exercise actual signing route/storage/PDF inputs, single/group PDFs, historical views, CSV, migration/RLS isolation and immutable evidence. Data-transfer suites cover original PDFs/images, backup restore, exports and a 10,005-row import.

The default `npm run lint` cannot traverse the unrelated inaccessible `output/font-tools/bin` directory. Application/scripts lint completed without errors. An existing unrelated responsive-contract test has a waiver-editor source assertion failure; the changed kiosk was checked in actual Chromium at desktop/tablet widths and 390px with no horizontal overflow.

Browser regression command: `npm run verify:kiosk:browser`. Supply `PLAYWRIGHT_MODULE` pointing to an installed Playwright module if it is not locally resolvable, and install Chromium through Playwright first. The harness starts its own loopback development server with webpack, creates a development-only temporary route using the actual signing components, mocks Turnstile and the fixture signing response, and removes its route/generated route types afterward. No customer record is submitted. Screenshots and measurements go to `tmp/kiosk/` and are local artifacts.

Covered in Chromium: one/two/family participants, separate guardian signatures and DOB payloads, drawn-signature ink retention across card navigation/submission, explicit typed signatures, back navigation, middle removal cancel/confirm, DOB validation focus, single kiosk, standard fields, retry data retention, French, clear cancellation, warning/continue/expiry, success reset and absence of signing PII in browser storage. Unit handler tests additionally cover guardian changes invalidating signatures and removing/readding participants.

## Manual acceptance checklist

1. As an owner, open `/settings/kiosk`. Save EN/FR welcome/instructions. Hide one eligible optional question. Confirm mandatory/legal/flagged questions cannot be selected. Verify non-owner users cannot save and another organization sees its own settings.
2. Open a published waiver's Share page and launch its kiosk URL on the actual desk tablet. Check welcome, language, scrolling, focus, touch controls and the entire waiver/consent. Confirm the normal `/w/<slug>` link remains unchanged.
3. Submit one adult and two adults with distinct DOBs. Try both Draw and explicit Sign with this name; edit a signature. Review names/DOBs and inspect the original signed detail/PDF and CSV afterward.
4. Add an adult and three children. Copy the primary participant's name into family guardian details, enter relationship once and opt in each child. Supply all seven signatures. Try one child with a different guardian. Confirm stored relationships, all DOBs and evidence in the completed record/PDF/export.
5. Edit a participant's name/DOB after signing and confirm resigning is required. Edit shared guardian details and confirm every affected guardian must resign. Remove the middle child, cancel once, then confirm; readd and verify the remaining name/DOB/signature pairs have not shifted. Test the ten-person limit.
6. Leave a participant incomplete and attempt Continue. Check its card/error/focus. Test future DOB, missing guardian relationship/signature, required custom acknowledgment, conditional medical detail and required photo on representative templates.
7. Use Back from review and return without losing entries. Simulate a network/service failure, retry, and verify exactly one authoritative record/PDF is created through existing idempotency handling.
8. Cancel Clear and confirm entries remain; confirm Clear and verify complete reset. Wait 150 seconds, continue signing, then wait 180 seconds without activity to verify clearing. Submit and verify automatic reset after five seconds. Attempt refresh to check the browser's dirty-form warning.
9. Repeat the family flow in French and at tablet portrait/landscape and a narrow viewport. Check keyboard-only navigation and dialogs. Time real users for all three scenarios before making signing-speed claims.
10. Verify historical single/group records, signed PDF download, CSV/ZIP exports, Front Desk check-in and existing signing-link billing/security behavior in a staging organization.

## Remaining risks

Browser submission and Turnstile are mocked; real production services, owner settings writes against a live database, physical touch hardware, screen readers and Safari were not end-to-end tested. Existing automated route/PDF/storage tests cover those data contracts, but staging acceptance is still necessary. Actual human completion speed and production upload latency are not established. Browser before-unload dialogs vary by platform. Settings share the existing read/merge/write branding convention, so concurrent branding edits retain its existing last-writer behavior.
