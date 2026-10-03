# TikTok browser measurement

Local implementation only. No Events API calls, campaign changes, deployment,
production migration or live conversion verification were performed.

## Enable only after review

1. Apply `0025_tiktok_measurements.sql` through the normal migration process.
   It was generated with the Supabase CLI and renamed to match this repository's
   numbered migration convention. No historical registrations are backfilled.
2. In TikTok Events Manager, select Pixel `DB02IERC77U04C8LUG70`. Keep Automatic
   Advanced Matching OFF. Disable Enhanced Data Postback, automatic/assisted
   events and Event Builder rules that would duplicate these custom-code events.
   The SDK can otherwise collect form/page information or infer events. These
   remote settings cannot be verified by this source-code change.
3. Confirm Creem delivers `subscription.paid` to the existing signed webhook.
   The existing production API key must allow reading transactions. No new key
   is needed. Stripe is dormant and is not wired for TikTok payments.
4. Set `TIKTOK_PIXEL_ENABLED=true` for Vercel Production only, then deploy when
   authorized. Default is false; preview/development never load the production
   Pixel, even with the flag set.

## Initialization, routes and consent

`src/app/layout.tsx` mounts one `TikTokPixel`. Its single `next/script` instance
in `src/components/tiktok-pixel.tsx` uses `afterInteractive`, initializes the
provided queue/Pixel ID, and loads
`https://analytics.tiktok.com/i18n/pixel/events.js` once. SDK `ready`, rather than
the inline loader's `onReady` alone, permits conversion delivery.

It uses the existing `fw-consent=granted` opt-in and `useConsent`; no second
consent system. Withdrawal calls `revokeConsent` and `disableCookie`, stops
new application events/requests, and is checked again before delivery.
Already transmitted events cannot be recalled. Removing a Script component
does not unload third-party JavaScript, hence explicit revocation.

The root installation is intentionally restricted to marketing pages, signup,
dashboard, billing and the new-waiver entry page. It excludes public signing,
kiosks, signed documents, waiver editors, auth callbacks, and admin screens.
Navigating to an excluded route revokes the loaded SDK's consent. Unknown URL
query parameters and URL fragments suppress initialization/events, preventing
invitation emails, auth codes and search terms from becoming event URLs. The
allowlist permits an opaque `ttclid` and `checkout=success` only. Links with
other query parameters (including UTMs) are intentionally not measured; use
clean landing URLs plus `ttclid`. No identifying `identify()` call is used.

## Registration

The existing successful new-business bootstrap inserts `registration_measurements`.
An AFTER INSERT trigger creates a separate TikTok candidate with the same stable
random event ID. Ordinary login, invites, failed signup, and signup-page views
do not insert candidates. No auth or bootstrap code changed.

On `/dashboard`, `/settings/billing` or `/waivers/new`, the browser asks
`POST /api/ads/tiktok` for events only after SDK readiness and consent. The
server verifies same-origin, consent, environment, authenticated owner, confirmed
email, profile, subscription and completed business name. OAuth users who land
directly in an editor are measured when they later visit one of these safe pages.
The browser calls `track("CompleteRegistration", {}, { event_id })`.

## Payments

The existing Creem webhook first verifies its signature. Only live
`subscription.paid` records a transaction reference in `tiktok_measurements`.
No checkout button, return query parameter or active-subscription status creates
a payment candidate. This additive best-effort write does not change billing
updates or billing deduplication. A repeated verified webhook can repair a failed
candidate write, but a write failure with no provider redelivery can lose tracking;
monitor the safe `[tiktok] payment candidate write failed` warning.

When the owner requests events, the server fetches that exact transaction from
Creem, checks live/paid status and matching subscription, and uses `amountPaid`
in cents divided by 100. It does not substitute the $19 catalogue price for
discounts or tax-inclusive amounts. Only positive USD payments are emitted;
unknown amounts, other currencies, test, pending and refunded transactions are
excluded. The browser sends `track("Purchase", { value, currency }, { event_id })`.
`Purchase` is the current documented standard payment event, replacing the older
preferred `CompletePayment` spelling in the request; never send both.

This records one event per paid transaction, including renewals if the owner
returns to an eligible page while the candidate remains valid. Browser-only
tracking cannot report payments without a returning, consenting browser.
Polling every 15 seconds handles webhook/redirect ordering while a safe
conversion page is open. No return URL is treated as evidence of payment.

## Idempotency and limitations

- Unique registration source and paid transaction source; stable random event ID.
- OpenAI's delivery state and route are untouched.
- Reserving does not consume. PATCH acknowledges only after an SDK call succeeds.
- Same-tab in-flight/queued sets prevent React rerender repeats and permit ack retry.
- Parallel tabs/devices use identical event name and ID. TikTok documents a
  48-hour Pixel deduplication window. Reservations expire 47 hours after the
  first reservation (and candidates expire seven days after creation), so late
  retries cannot turn into new counts beyond that window.
- Acknowledgment means queued to the ready SDK, not TikTok network receipt. An ad
  blocker or network failure can still lose events. This is not exactly-once
  transport. Nothing has yet been observed in TikTok Events Manager.
- Revoked/no consent never reserves or acknowledges an event.
- RLS, revoked public/anon/authenticated grants, service-role-only RPCs,
  owner checks and org/subscription matching protect conversion records.
  The eligibility helper alone uses a fixed-search-path definer to read the
  private auth table; public/anon/authenticated cannot execute it.

## Verification

`npm run verify:tiktok-pixel` exercises helpers, the actual SDK setup in a mocked
browser, actual HTTP exports with mocked auth, and real SQL in local PGlite.
It covers denied/revoked consent, one initialization, SDK readiness, sensitive
routes/URLs, failed payment types, actual discounted values, new vs existing
accounts, stable reservations, OpenAI independence, cross-org isolation,
idempotent acknowledgment and the retry cutoff.

After an approved rollout, use TikTok Events Manager Test Events and Pixel Helper:
deny consent and confirm no TikTok SDK requests; accept and confirm one page event;
complete a fresh verified business signup and look for CompleteRegistration;
refresh and open another tab to verify no new logical registration. Complete a
real authorized payment, wait for the signed webhook, and confirm Purchase with
the actual paid USD value. A manually visited success URL must emit nothing.
Check withdrawal and the Network panel on signing/document pages. Do not make a
real payment merely to test without the account owner's authorization.

## Future Events API

Use the same completed-business eligibility and verified `subscription.paid`
transaction, via a durable backend outbox. Store per-destination delivery status
and lawful consent/attribution with the event. Use precisely the same `event_id`,
event name, Pixel ID and payment properties in browser and server copies, within
TikTok's deduplication window. Do not generate a second ID for an API retry.
No server API or credentials are added in this change.

## Official references inspected

- https://ads.tiktok.com/help/article/standard-events-parameters?lang=en
- https://ads.tiktok.com/help/article/event-deduplication?lang=en
- https://ads.tiktok.com/help/article/how-to-set-up-automatic-advanced-matching?lang=en
- https://ads.tiktok.com/help/article/using-cookies-with-tiktok-pixel
- https://docs.creem.io/code/webhooks
- Installed Next.js Script and route-handler documentation; installed Creem
  subscription/transaction SDK types and transaction lookup API.

Additional source inspected: root layout; consent/banner; GA4 scripts; OpenAI
component/helper/registration route and migrations 0019/0022; signup; auth callback;
onboarding; app-layout bootstrap; Creem checkout/webhook/config; dormant Stripe
webhook; privacy page; existing verification scripts.

## File inventory

Modified:
- `.env.example`
- `package.json`
- `src/app/layout.tsx`
- `src/app/privacy/page.tsx`
- `src/app/api/webhooks/creem/route.ts`

Added:
- `src/components/tiktok-pixel.tsx`
- `src/lib/tiktok-pixel.ts`
- `src/lib/tiktok-payment.ts`
- `src/app/api/ads/tiktok/route.ts`
- `supabase/migrations/0025_tiktok_measurements.sql`
- `scripts/verify-tiktok-pixel.mjs`
- `scripts/verify-tiktok-sdk-setup.mjs`
- `docs/tiktok-pixel.md`

Existing implementation inspected (unchanged unless listed above):
- `src/app/layout.tsx`, `src/app/(app)/layout.tsx`
- `src/components/analytics.tsx`, `src/components/analytics-scripts.tsx`
- `src/lib/consent.ts`, `src/components/cookie-consent.tsx`
- `src/components/openai-pixel.tsx`, `src/lib/openai-pixel.ts`
- `src/app/api/ads/registration/route.ts`
- `src/app/signup/page.tsx`, `src/app/auth/callback/route.ts`
- `src/app/onboarding/actions.ts`, `src/lib/bootstrap.ts`, `src/lib/auth.ts`
- `src/app/api/creem/checkout/route.ts`, `src/app/api/webhooks/creem/route.ts`
- `src/lib/creem.ts`, `src/lib/creem-environment.ts`
- `src/app/api/stripe/webhook/route.ts`, `src/lib/supabase/admin.ts`
- `src/app/privacy/page.tsx`, `.env.example`, `package.json`, `AGENTS.md`
- `supabase/migrations/0019_registration_measurement.sql`
- `supabase/migrations/0022_registration_measurement_delivery.sql`
- Existing OpenAI, cookie-consent and billing-journey verification scripts.
