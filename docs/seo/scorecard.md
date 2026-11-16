# SEO monitoring scorecard and release record

Prepared 2026-11-16. No SEO recovery release has occurred. Fill the actual production release date and approved commit SHAs after owner approval. Dates below refer to reporting windows, not a scheduled automation.

## Baseline evidence

User-supplied GSC audit (not re-exported from the protected property):

| Window | Impressions | Clicks | CTR | Average position |
|---|---:|---:|---:|---:|
| 2026-11-08–2026-11-14 | 742 | 1 | approximately 0.1% | 24.2 |
| 2026-08-15–2026-11-14 | 6,340 | 67 | approximately 1.1% | 19.5 |

User reported 31 indexed URLs, 11 excluded URLs, three external links from two domains. Excluded favicon/image resources are not equivalent to excluded commercial pages. `/blog/waiver-software-cost` had a reported crawled-not-indexed state. Live HTTP checks confirm a 200 self-canonical page in the sitemap; Google-selected canonical and current coverage remain unknown without URL Inspection access.

Small-sample query positions supplied by owner: gym waiver software 10.9; waiver software for gyms 12.0; climbing gym liability waiver software 10.6; climbing gym waiver app 14.9; trampoline park waiver software 11.0; smartwaiver alternatives 3.6; waiver software pricing 11.4; electronic signature waiver 12.6; electronic waivers 57.2; best waiver software 87.9. Do not infer a penalty or proven cannibalization from these numbers.

## Repeatable matched-window exports

Use GSC Web search, final complete dates, same search type/property and matched 28-day periods. Save raw exports outside git if they include private query or customer data. Compare US, UK and Canada separately, then mobile/desktop. Record total impression/click numbers and sample sizes, not just percentage changes. GSC query privacy filtering means query totals can differ from page totals.

1. Before release: latest complete 28 days versus preceding 28 days, and year-over-year if available. Separate case-insensitive brand variants (`flatwaiver`, `flat waiver`, domain variants) from non-brand queries.
2. At 28 days after release: first complete post-release 28 days versus the pre-release matched 28 days. Annotate release days, seasonality, paid campaigns and other product changes.
3. At 8 weeks: compare days 29–56 with days 1–28 and with pre-release. Review query→page ownership before recommending any consolidation.
4. At 12 weeks: compare days 57–84, days 29–56 and pre-release. Review relevance, conversions and sample sizes. No ranking target is promised.

| Metric | Source / dimensions | Record / decision |
|---|---|---|
| Qualified non-brand organic clicks | GSC query+page, country, device | Commercial clusters versus irrelevant queries; both counts and CTR |
| Commercial impressions and positions | Gym, climbing, trampoline, pricing and comparison clusters | Weighted GSC averages, query sample size and primary/supporting page |
| Index coverage | GSC Pages + URL Inspection | Homepage canonical, `/index` redirect, cost article Google-selected canonical; actual confirmation date |
| Organic landing sessions | GA4 session source/medium, landing page | Exclude admin/participant surfaces and existing-account activity where evidence supports it |
| Organic trials | Verified `sign_up`, source and landing context | Confirmation/OAuth gap must be resolved before treating as complete |
| Activation | `waiver_published`, source context | Separate repeated publishes; no org-first milestone currently verified |
| Paid acquisition | Verified payment ledger / future deduplicated GA4 event | No existing GA4 purchase evidence; don't use checkout redirects as payment |
| Relevant referring domains | GSC Links + verified listing/partner URLs | Count real relevant placements, not submission attempts |
| LCP / INP / CLS | CrUX/GSC field reports by device | Field data if available; otherwise report unavailable. Lab scores are diagnostic, not field CWV |
| Technical regressions | `verify-seo.mjs`, build, links, metadata | Run before each SEO release and against production after approval |

## Protected-account checks requiring owner access

GSC query/page/country/device exports, URL Inspection for the cost guide (declared/Google-selected canonicals, last crawl, coverage), GA4 stream/enhanced measurement inspection, DebugView test deliveries, and actual paid-customer attribution. No Google indexing or traffic improvement can be claimed from a code change alone.

## Release log

| Release date | Change / approved SHA | Smoke test | Follow-up owner |
|---|---|---|---|
| Pending approval | Canonical and redirect | `/`, `/index`, query, apex/www, sitemap | Owner |
| Pending approval | Verified pricing and content | Calculator boundaries and article tables | Owner |
| Pending approval | Commercial pages and internal links | Responsive pages, forms/navigation, sitemap | Owner |
| Pending measurement approval | Analytics | Nonproduction DebugView and consent tests | Owner |
