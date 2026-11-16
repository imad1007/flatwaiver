# Review status and release order

Prepared 2026-11-16. All PRs are drafts. No merge, production deployment, CMS publication, outreach or production analytics setting change is authorized by this packet.

| Order | Concern | Branch | Commit | Draft PR | Base |
|---|---|---|---|---|---|
| 1 | Canonical and legacy redirect | `seo/technical-canonical-2026-11-16` | `4d821873772ee43e36f9492a59d5b878c58b3231` | [#2](https://github.com/imad1007/flatwaiver/pull/2) | `main` |
| 2 | Effective prices and evaluation content | `seo/pricing-2026-11-16` | `b469a55c2e833730f7251e6f78b143ea3f85a2dd` | [#3](https://github.com/imad1007/flatwaiver/pull/3) | canonical branch |
| 3 | Commercial pages and workflows | `seo/commercial-2026-11-16` | `7960c86d652a6a2ece76a98ebd162660d44d32d0` | [#4](https://github.com/imad1007/flatwaiver/pull/4) | pricing branch |
| 4 | Measurement safeguards | `seo/measurement-2026-11-16` | `9837637d7825ff8b8bcf3cf2a0ce2fe0b5bffbd8` | [#5](https://github.com/imad1007/flatwaiver/pull/5) | commercial branch |
| 5 | Final QA, performance and review packet | `seo/recovery-2026-11-16` | See final commit in PR | Pending final validation | measurement branch |

Each PR isolates one concern relative to its base. This is a stacked review: after an approved merge, retarget the next PR appropriately and review the complete final tree. Do not release an intermediate commercial tree without the final QA corrections. Analytics remains separately gated by `measurement.md`; preparing a PR does not approve activating it.

Changed files are available in each PR's Files changed tab. The implementation/file map and concern-specific release checks and rollback are in `README.md`; detailed test evidence is in `validation.md`. Existing parent-workspace changes are excluded.

## Changed files by concern

### Technical

- docs/seo/production-baseline.json
- next.config.ts
- src/app/page.tsx
- src/app/sitemap.ts

### Pricing

- content/blog/flatwaiver-vs-smartwaiver.mdx
- content/blog/smartwaiver-alternatives.mdx
- content/blog/smartwaiver-pricing.mdx
- content/blog/waiver-software-cost.mdx
- content/blog/waiver-software-for-climbing-gyms.mdx
- scripts/verify-marketing-pricing.mjs
- src/app/page.tsx
- src/components/marketing/pricing-reference.tsx
- src/components/marketing/savings-calculator.tsx
- src/components/mdx-components.tsx
- src/lib/competitor-pricing.ts

### Commercial

- content/blog/gym-waiver-software.mdx
- src/app/features/qr-code-waivers/page.tsx
- src/app/industries/climbing-gyms/page.tsx
- src/app/pricing/page.tsx
- src/app/sitemap.ts
- src/components/marketing-chrome.tsx
- src/components/marketing/homepage-sections.tsx
- src/components/marketing/industry-landing.tsx
- src/lib/industries.ts

### Measurement

- docs/seo/measurement.md
- scripts/verify-acquisition.mjs
- src/app/signup/page.tsx
- src/components/analytics-scripts.tsx
- src/components/analytics.tsx
- src/components/signup-conversion.tsx
- src/lib/acquisition.ts
- src/lib/consent.ts
- src/lib/product-analytics.ts

