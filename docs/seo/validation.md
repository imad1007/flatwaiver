# Validation log

Worktree: `tmp/seo-recovery`; deployed baseline SHA: `6a37ffb`; no SEO release.

- Production HTTP baseline: completed; `production-baseline.json`.
- Production Lighthouse mobile homepage: completed; report and CPU warning in `performance.md`. PageSpeed API returned 429; no field INP/CrUX result.
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-marketing-pricing.mjs`: PASS (effective prices, full tier boundaries, historical rates, invalid input, annualized arithmetic).
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-acquisition.mjs`: PASS (consent, excluded surfaces, first observed touch, TTL, query/referrer minimization and referrer spoof rejection).
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/verify-billing-offer.mjs`: PASS, 3 scenarios; no payment/provider mutation.
- First `node scripts/verify-seo.mjs`: PASS, 13 pages, 33 internal destinations, canonical/OG/H1/JSON-LD, `/index`, query, apex and trailing-slash handling, sitemap, preview robots and auth noindex. Initial assertions exposed Next's root-origin serialization and Node fetch's Host override behavior; tests now normalize URLs and use an HTTP Host header for the local host test.
- `npm.cmd run lint`: existing errors in tracked `output/check-admin-preview.cjs` and `output/delete-requested-accounts.cjs` (`no-require-imports`). SEO unused-import/state warnings were corrected. Application source/new-script lint re-run separately.
- Initial isolated `next build --webpack`: PASS, including TypeScript and generation. A final build and browser pass follow the performance/accessibility corrections.

Responsive browser verification is recorded in the final section below.

Not executed: real account signup/email confirmation/Google OAuth, live payment, new waiver publication, production signing, private GA4/GSC inspection, external submissions, CMS publication. Navigation tests do not imply any of those transactions were performed.

## Final build and source checks

- Final frozen-source `next build --webpack`: PASS, TypeScript and all 81 routes generated.
- ESLint over application source, Next config and the four new verification scripts: PASS. The full repository lint remains blocked by the pre-existing output utility errors above.
- Final `node scripts/verify-seo.mjs`: PASS, 13 pages and 33 internal destinations, redirects/query handling, metadata, structured data, sitemap, preview robots and auth noindex.
- Second production Lighthouse diagnostic: retained for the gym landing page; see `performance.md`. Both reports are baselines, not claimed improvements.
- `git diff --check`: PASS (Windows line-ending notices only).

Browser harness notes: the first run completed light-mode layouts but timed out on background network activity. The deterministic harness now blocks all third-party requests and disables screenshot animations. An initial demo assertion ran before its dynamic chunk loaded; it now waits for the visible form rather than a static section heading. Neither adjustment changes application code.
The typed-signature control uses a visually hidden native radio inside a visible label. The harness now clicks that user-facing label and verifies the radio state, rather than trying to click the hidden input.

## Final browser result

PASS: 36 views (six marketing pages, light/dark, 390/768/1440px), no horizontal overflow, one H1, signup destinations present; deferred demo loaded, typed signature and consent produced a sample receipt, reset restored the form; signup/login returned 200 with visible headings. No accounts or real signatures created. `browser-verification.json` and 24 screenshots retained. Representative light mobile pricing/climbing and light/dark desktop QR screenshots inspected visually; no clipping or unreadable text found in those views. Third-party calls are blocked in this UI-only smoke harness, so it does not verify analytics delivery.
