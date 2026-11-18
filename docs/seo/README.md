# SEO recovery implementation and review packet

Prepared 2026-11-16. **Not merged, not deployed, no CMS publication or production settings changes.**

## Production/source reconciliation

GitHub/Vercel reports the completed `main` deployment at `6a37ffba9a88183b209516f245217c7fc4509db8`. Live HTTP behavior is recorded in `production-baseline.json`. The parent workspace remains on `main` with substantial pre-existing application, auth, billing, signing, export, staging and analytics edits. Work is isolated in `tmp/seo-recovery`, branch `seo/recovery-2026-11-16`, based on the deployed commit; none of those uncommitted changes were brought into these PRs. Do not deploy the parent working tree as a shortcut.

Installed Next.js: 16.2.10, React 19.2.4, Tailwind 4. Relevant installed Next metadata/CSS documentation was consulted. Local builds use `next build --webpack` because this nested worktree shares the existing dependency installation through a junction. Next reports multiple lockfiles; no dependencies or lockfiles were cahanged.

## Route and content boundaries

- Public marketing: `/`, `/industries`, individual industries, `/blog`, blog articles, `/security`, `/support`, `/privacy`, `/terms`; proposed `/pricing` and `/features/qr-code-waivers`.
- Private app: `/dashboard`, `/waivers`, `/signatures`, `/data`, `/settings`, `/help`, `/checkin`, `/onboarding`; platform admin `/admin`. Existing proxy/auth/billing behavior remains unchanged.
- Signers: `/w/[slug]`, `/w/[slug]/done`, `/kiosk/[slug]`; existing noindex and operational URLs unchanged.
- API/auth handlers remain unchanged. Signup page changes are telemetry-only; same Supabase request, fields and redirect.
- Marketing and cornerstone guides are source-controlled. `blog-merge.ts` combines MDX with published `blog_posts`; database articles use sanitized HTML. DB-only articles are preserved and their proposed changes live in `cms-drafts.md`.

## Implementation and files

| Concern | Files / result | Why |
|---|---|---|
| Homepage canonical | `src/app/page.tsx`, `next.config.ts`, `src/app/sitemap.ts` | Explicit www root canonical/OG, `/index` 308 to `/`, canonical root in sitemap. Other routes keep self-canonicals. Next serializes a bare origin for the root URL; parsing it yields `https://www.flatwaiver.com/`, not `/index`. No global trailing-slash change. |
| Pricing source | `src/lib/competitor-pricing.ts`, `marketing/pricing-reference.tsx`, `mdx-components.tsx` | Shared effective rates, dated official sources, historical schedule retained as history. No inferred Premier allowance. |
| Calculator | `marketing/savings-calculator.tsx`, homepage comparison | Defaults to effective October rates, removes obsolete future-period selector; base-plus-usage providers excluded from numerical chart with explanation. Exact tier coverage, no interpolation. |
| High-intent guides | Five MDX comparison/pricing/climbing guides | Current buyer information, worked arithmetic, workflow-fit and migration limits. New facts have real modification dates. No URL removals/consolidation. |
| Internal links | `marketing-chrome.tsx`, `homepage-sections.tsx`, gym guide | Product CTA goes to fitness commercial page; educational guides retained. Footer links expose pricing, QR, gym and trampoline pages. Cost guide receives a direct homepage comparison link. `/#pricing` remains intact. |
| Industries | `industry-landing.tsx`, climbing page, `industries.ts` | Labeled static signing preview using existing form conventions; differentiated arrival checklist, group/guardian facts and limitations; climbing breadcrumb includes hub. |
| New commercial pages | `/pricing`, `/features/qr-code-waivers` | Standalone offer/limits/retention explanation; QR setup/retrieval workflow. Server-rendered content, metadata, conversion links and sitemap entries. No broad synonym-page expansion. |
| Accessibility/performance | Homepage table scopes and text opacity, footer, `lazy-signing-demo.tsx` | Fixes measured headers/contrast issues and defers below-fold signature-pad code. Public signing logic untouched. |
| Measurement | `acquisition.ts`, `analytics-scripts.tsx`, `product-analytics.ts`, `consent.ts`, signup telemetry, `.env.example` | Coarse consented context, explicit surface labels, conservative immediate-session signup event and opt-in manual pageviews. See `measurement.md` for incomplete paths and release conditions. |
| Verification | `verify-seo.mjs`, `verify-seo-browser.mjs`, `verify-acquisition.mjs`, pricing test | Repeatable metadata/redirect/link, UI, privacy and arithmetic checks. |

The complete URL/keyword/title/description/canonical ownership map is `keyword-page-map.csv`. Commercial destinations own product-selection intent; guides own evaluation/implementation intent. No harmful cannibalization or penalty is asserted.

## Evidence for product and pricing claims

- `APP.priceMonthlyUsd=19`, `APP.trialDays=14`; subscription bootstrap and billing checks inspected.
- Creem is active, Stripe dormant. `assertCheckoutProductMatchesOffer` validates active USD 1900-cent recurring monthly configuration at checkout. Unit checks pass; no live provider product was queried and no payment was made.
- Existing public SigningForm, SignatureCanvas, group participants, SharePanel, template publishing and record/PDF/export code support the stated core workflows. Static previews use synthetic details; no real customer records or signatures were accessed for visuals.
- Official Smartwaiver [effective price notice](https://support.smartwaiver.com/hc/en-us/articles/48619421464845-Smartwaiver-Subscription-Pricing-Update-Overview-FAQs) supersedes stale figures on its indexed pricing page. Allowances retained only where documented; Premier/Enterprise excluded from calculator coverage.
- [WaiverForever](https://www.waiverforever.com/pricing): feature-plan base plus usage; no invented all-in volume total.
- [WaiverSign](https://www.waiversign.com/digital-waiver-pricing): monthly allowance plus $0.15 additional waivers; annual commitments kept separate.
- [WaiverFile official standalone terms](https://help.waiverfile.com/Pricing.aspx): monthly tiers and overages; main pricing site's transaction-priced booking offer distinguished from waiver-only plans.

## Technical findings and indexing limits

Live production `/` and `/index` both returned 200 with `/index` canonical and OG URL. Fix verified locally, not deployed. The cost guide is 200, self-canonical, server-rendered and in the sitemap; these were already true at baseline. Its content, links and maintenance were improved, but Google-selected canonical and current coverage require authenticated GSC URL Inspection. **Indexing is not declared fixed.** Resource/icon exclusions are not a reason to remove useful content or block Google from discovering noindex.

Robots remains crawlable in production and disallow-all in preview. Auth pages retain noindex and are excluded from sitemap. Application layouts and public signer pages retain their existing noindex. No canonical, robots or redirects were changed for signed-document URLs. No migrations, RLS, payment/signing logic or customer records were changed.

## Validation and artifacts

See `local-verification.json`, `browser-verification.json` and `performance.md`. Final command outcomes are recorded in `validation.md`. New report files contain only public marketing data and synthetic checks. Browser screenshots are local review artifacts under `docs/seo/screenshots/`.

Lighthouse raw report is retained for reproducibility. The Google PageSpeed API quota response is also retained; neither is represented as GSC/CrUX field data. No actual organic ranking, index coverage or revenue improvement is claimed.

## Release and rollback

1. Owner reviews canonical/redirect PR first. After explicit merge/deploy approval, verify www root 200, `/index` 308, preserved query attribution, apex/www and trailing-slash chains, canonical/OG and sitemap. Expected apex `/index` may take an existing host redirect before the new path redirect; there is no loop.
2. Review pricing/content PR against official sources. Recheck at approval if pricing has changed. Verify calculator at 100/101/200/201/300/301/600/601/1000/1001/2500/2501 and article tables.
3. Review commercial-page PR and the final QA/performance changes. Approve new pages before production. Smoke-test pricing/QR/three industries, links, mobile layouts and signup/login navigation. Old `/#pricing` links remain supported.
4. Keep the analytics PR separate until `measurement.md` rollout conditions are accepted. Don't turn on manual views while automatic history pageviews are active. No GA4 filter/key-event/stream setting changed here.
5. Approve CMS drafts separately and save prior CMS revisions before publishing. Approve directory submissions/outreach separately.

For code rollback, revert the approved concern's commits through a reviewed PR or promote the previous known-good Vercel deployment. No database rollback is required. For analytics rollback, revert the telemetry commit and leave the manual flag disabled; coordinate any owner-approved GA4 settings reversal to prevent duplicates. No public signing URLs change in either direction. Keep prior CMS content for independent CMS rollback.

Follow-up owners and matched-window reporting instructions are in `scorecard.md`. Authority opportunities, submission requirements, free/paid status and unsent drafts are in `authority-plan.md`.

Draft PR links, branch names, commit SHAs and changed files by concern are recorded in [review-status.md](review-status.md).
