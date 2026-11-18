# Final SEO release review — November 18, 2026

No merge, production deployment, customer-data change, CMS publication or production analytics-setting change performed. Original parent workspace and the uncommitted README edit in `tmp/seo-recovery` are preserved. Worktree for this release: `tmp/seo-release`.

## SHA reconciliation and cleanup

`829d1bcca42b88db78da13b2aeb55463cfdbc925` to `04b9aff22fc944627627c56350275ad2d20fafcc` changed only `docs/seo/review-status.md` (54 additions, one deletion). No application, configuration or verification script changed. The final head therefore represented the tested application tree, plus a documentation update; it was not a newly tested implementation.

PR #6 cleanup commits `5f0f1c1` and `975e87a` add a targeted ignore list and hash manifest and untrack 29 generated files. Scripts, source, keyword mapping, baseline, summaries and release instructions remain tracked. Archived files total 4,154,297 bytes; access and hashes are in `evidence-archive.md`. Original commit links remain available. This shrinks the current PR diff; it does not erase existing Git objects or claim to shrink historical clones. No force-push was used.

## Current release architecture

The original verified dependency chain was main → #2 → #3 → #4 → #5 → #6. All five were open drafts, conflict-free, with Vercel success at their original heads. No human review comments or inline threads were returned; Vercel bot comments supplied preview URLs. No GitHub Actions workflows were present; a green Vercel status is a deployment/build result, not proof that our custom tests ran in CI.

The new `seo/release-without-analytics-2026-11-18` branch starts at commercial SHA `7960c86`, cherry-picks only QA/documentation commits `829d1bc` and `04b9aff`, then applies evidence cleanup and final corrections. It excludes measurement SHA `9837637` and has no changes to the baseline analytics implementation. The analytics environment flag was also excluded. The measurement review document is included as documentation only.

Use a single replacement release PR targeting **main** for an atomic SEO release. Its complete tree includes #2, #3, #4 and required QA/performance fixes. Original #2–#4 remain concern-level review references; do not merge them separately before the combined release. Original #6 is superseded by the replacement release and must not be merged. PR #5 remains separate, based on the commercial branch until an approved SEO release lands; retarget it to main afterward and confirm its diff contains only telemetry. Prefer a merge commit for the combined release to preserve the existing ancestor chain; a squash merge requires rechecking/rebasing later analytics diffs before review.

An analytics-inclusive alternative remains in the preserved original recovery branch, but it is **not approved or recommended for production**. No deployment plan should use that tree until the separate rollout requirements in `measurement.md` are complete.

## Actual code review and corrections

- Explicit www-root homepage canonical and OG; `/index` 308; existing host redirect preserved. Next serializes bare-origin root metadata, which normalizes to `/`. Marketing self-canonicals, auth/private noindex, preview robots and sitemap ownership reviewed. No global trailing-slash behavior changed.
- New pricing and QR pages have a single descriptive H1, self-canonicals, OG/Twitter metadata, useful workflow and limitations, signup destinations and sitemap entries. Pricing JSON-LD uses the configured USD monthly offer; no fabricated reviews or legal guarantees.
- Price-range separator repaired in Smartwaiver summary. Current price-review date refreshed; historical date remains historical. Hard-coded review-date test replaced with a valid-date assertion; arithmetic and tier tests unchanged.
- WaiverSign's unsupported $189/2,500 statement replaced with its currently published $149/1,000 allowance plus $0.15 extra, and quote requirement above 2,500. Cost guide modification date advanced to November 18.
- [Smartwaiver effective-price notice](https://support.smartwaiver.com/hc/en-us/articles/48619421464845-Smartwaiver-Subscription-Pricing-Update-Overview-FAQs), [WaiverFile standalone plans](https://help.waiverfile.com/Pricing.aspx), [WaiverForever model](https://www.waiverforever.com/pricing) and [WaiverSign](https://www.waiversign.com/digital-waiver-pricing) checked November 18. Smartwaiver main pricing returned 403 in the reader; indexed official pricing remains stale, so the dated effective-price notice is the price authority. No newly invented Premier allowance or usage totals.
- Browser checks stamp the actual run date instead of a fixed November 16 date. Generated reports remain local/CI outputs through narrow ignore patterns.
- A production-mode test exposed a pre-existing missing signup noindex directive, masked by blanket preview noindex in earlier tests. Added only `robots: { index: false, follow: false }` to signup layout metadata and corrected its obsolete sitemap comment; auth request/redirect behavior is unchanged. A remaining malformed possessive in the gym-preview heading was also repaired.
- Protected operational files have zero diff against production baseline, except that explicit signup metadata correction: signup/login behavior, auth callbacks and OAuth configuration, API checkout/signature/export routes, app/dashboard/front-desk pages, proxy, public sign/kiosk routes, Supabase clients, PDF code, migrations, signing/guardian components and dependencies. These flows were not exercised using real customers. No schema, RLS, credentials or customer data changed.
- New preview and copy changes do not promise booking integrations, offline signing, guardian verification, compliance certification or enforceability. Useful existing URLs remain; DB-authored content stays draft-only.

## Analytics decision

**Separate release, NO-GO for activation now.** Consent/storage tests pass, but manual views disabled by default do not control an already-loaded SDK's automatic history/form events. Route surfaces are not authenticated roles; client registration lacks a durable once-only ledger; confirmation/OAuth and payment attribution remain incomplete. Exact nonproduction property, consent, deduplication, signup, dimension and payment requirements are in `measurement.md`. No production GA4 configuration changes are part of SEO approval.

## Verification commands and classification

Final outcomes and the exact tested source revision will be appended after this candidate completes build/browser checks. The source was frozen before the production build; later edits are tests/documentation only.

- Build helper invokes installed Next 16.2.10 `next build --webpack`, sets `VERCEL_ENV=production`, and uses existing build-time public blog reads. Explicit GA/Ads/Clarity environment identifiers are omitted in the local test build; the baseline GA fallback still exists. UI checks deny consent and block third-party traffic. Analytics delivery is not verified.
- Full `npm.cmd run lint`: FAIL, pre-existing 11 `no-require-imports` errors in `output/check-admin-preview.cjs` and `output/delete-requested-accounts.cjs`; zero new source warnings reported. These utilities are unchanged.
- The first production-mode HTTP run failed on missing signup noindex (pre-existing SEO issue); corrected in source. A browser run was interrupted for that rebuild (environmental connection-refused outcome, not a passing run). Both must pass on the final revision.
- Pricing verification initially failed on a hard-coded old review date. Classified as a stale test exposed by the review-date correction; corrected and rerun successfully.
- Environment: nested worktree emits a multiple-lockfiles warning. No package/lockfile changes. No field CWV or indexing improvement is claimed.
- Unverified dependencies: actual payment, email confirmation/Google OAuth transactions, customer signing and export transactions, protected GSC/GA4, production deployment logs/settings. Static non-regression evidence does not substitute for live transactional tests.

## Controlled deployment and rollback

1. Owner explicitly approves the combined SEO-only PR and production deployment at its final SHA. Verify its preview is Ready and only intended changes are present. Confirm main still matches the baseline or rebase/retest against any newer main.
2. In Vercel project settings, confirm Production branch, auto-assignment and deployment checks. Bot statuses demonstrate automatic preview builds; protected production settings were not available through the connected tools. [Vercel's documented behavior](https://vercel.com/docs/git) is production deployment on a production-branch merge. Treat a merge to main as an immediate production action. Do not merge merely to stage changes.
3. Confirm the prior known-good production deployment at SHA `6a37ffba9a88183b209516f245217c7fc4509db8` is retained and rollback is available: [baseline Vercel deployment](https://vercel.com/imadhamdouch0-8763s-projects/flatwaiver/8qe6JZiXb2LwNX81xHTUzp9vueur). No DB migration is needed.
4. Merge only the combined release PR, using the approved method. Do not merge #5 or the superseded #6, and do not deploy from the dirty parent worktree. No GA4/env/CMS changes accompany this release.
5. Run `SEO_BASE_URL=https://www.flatwaiver.com SEO_EXPECT_INDEXABLE=true node scripts/verify-seo.mjs` using appropriate PowerShell environment-variable syntax below. It is read-only. Expect root 200 and normalized root canonical; `/index` 308 to www root with query retained; industry trailing slash 308; intended sitemap URLs unique; robots Allow /; auth noindex; 13 marketing pages and discovered internal links valid. Apex check in this script is local-only: manually verify `https://flatwaiver.com/` and `/index` reach www root with no loop.
6. On phone and desktop, check pricing calculator at 100/101/200/201/300/301/600/601/1000, current rates and disclosure; `/pricing`, QR and gym/climbing/trampoline links; mobile menu; signup/login and existing query handling. Complete only the synthetic homepage demo. Check an owner-selected existing public signing URL opens its unchanged form and QR entry point; do not submit a real waiver. Never put private tokens in the public report. An unknown slug 404 is not a compatibility test.
7. Owner checks Vercel production logs for new 5xx/404s and compares auth, checkout, record/CSV/PDF and public-signing entry points with baseline. Use an approved staging/test account for transactions; production data is not modified as a release smoke test. Check again after cache/revalidation and at 24 hours. Record observed results and release SHA.
8. On new SEO-route errors, redirect loops, noindex production, or operational regressions, stop rollout and use Vercel Instant Rollback to the retained known-good production deployment. If a code revert is needed, prepare and approve a revert of the combined merge through a PR, test it and deploy under the same approval. Do not reset or force-push main. No schema rollback or signed-PDF regeneration is needed. Keep CMS drafts unpublished and analytics untouched.

PowerShell read-only post-release verification:

```powershell
$env:SEO_BASE_URL='https://www.flatwaiver.com'
$env:SEO_EXPECT_INDEXABLE='true'
node scripts/verify-seo.mjs
```

This plan is preparation, not authorization to run a merge, production deploy, configuration change or transactional production test.
