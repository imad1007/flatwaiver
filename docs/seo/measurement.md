# Organic acquisition measurement — review and rollout

Prepared 2026-11-16. No production settings changed.

## Observed implementation

- GA4 currently initializes after `fw-consent=granted`. Google Ads shares its gtag loader; Clarity is separate.
- Existing Google Ads `conversion` was called after a non-error email signup response, even when email confirmation was still required. It was not a GA4 registration event and did not cover the Google OAuth journey.
- Product events already include `onboarding_completed`, `waiver_draft_created`, `waiver_draft_saved` and `waiver_published`. Publication is emitted after the publish operation resolves; it is not an org-level first-publication event.
- OpenAI `registration_completed` and TikTok `CompleteRegistration`/`Purchase` have separate server-backed measurement mechanisms. Their delivery claims must not be consumed by GA4 or treated as GA4 events. These implementations are unchanged.
- Creem is the active billing provider; Stripe is dormant. No GA4 paid-subscription event was found. A checkout success URL is not payment evidence.

## Implemented

`acquisition.ts` retains a 30-day, consented first observed marketing touch in localStorage, with three coarse parameters: `landing_page`, `acquisition_source`, `acquisition_medium`. Query values and fragments, referrer paths, names, email addresses, click identifiers and account/waiver IDs are not stored or sent by this helper. Known paid-click parameters classify a visit as paid without retaining their values. Consent denial clears storage. Blocked storage degrades to empty context.

Marketing, prospect, account, admin, participant and other are **route surfaces**, not verified user roles. An existing account holder visiting a marketing page still has a marketing surface. Do not label these values as authenticated audiences. A platform admin browsing an ordinary public page cannot be identified without additional authenticated context, which is intentionally not fetched for marketing analytics.

Admin and participant routes do not initialize new GA/Ads/Clarity scripts through AnalyticsScripts. Clarity initializes only on marketing surfaces. This cannot unload an SDK that was already loaded earlier in an SPA session; automatic GA history tracking remains a rollout prerequisite below. Existing advertising SDKs are preserved and require their own privacy review if their scope changes.

`trial_cta_click` records a marketing link to same-origin `/signup`, without intercepting navigation. It is an intent event, not a completed trial.

GA4 `sign_up` and the existing Google Ads conversion are now called only for immediate authenticated email-signup sessions with a real returned identity, excluding team invitations. The existing auth request and redirect are unchanged. Email-confirmation-required and Google OAuth registrations remain an explicitly unmeasured GA4 gap. No successful test account or real GA4 delivery is claimed. A complete cross-device signup ledger requires a separately reviewed server-backed design; browser storage alone cannot provide it.

Existing product events now recheck consent and route permission at send time and include the coarse acquisition context. They keep their original names. No extra `first_waiver_published` or `purchase` event is fabricated. First publication and paid acquisition cannot be reliably reconstructed from a button click or a browser flag.

## Manual pageview gate — disabled by default

`NEXT_PUBLIC_GA_MANUAL_PAGEVIEWS=true` switches off config-generated views and emits coarse explicit `page_view` events. This flag must **not** be enabled until an owner approves disabling automatic History-based pageviews in the GA4 web stream. Leaving both on double counts. See [Google's pageview guide](https://developers.google.com/analytics/devguides/collection/ga4/views).

Before releasing the analytics PR:

1. Use a nonproduction GA4 property. Approve and inspect Enhanced Measurement, including pageviews, history, form events and outbound-click collection. Turn off automatic history/form collection for the manual route-controlled mode; otherwise private URLs and form context may still be collected by the previously loaded SDK.
2. Approve the manual-pageview flag and GA4 custom event dimensions for `audience_type`, `landing_page`, `acquisition_source`, `acquisition_medium`. These are proposed configuration tasks, not changes made here.
3. In DebugView, navigate public landing → signup → account → admin and signer routes. Confirm one permitted pageview, no admin/signer custom views, masked account paths, no query values or document titles on account screens. Test consent revoked after initial loading.
4. Use safe test accounts for email (both immediate session and confirmation), Google OAuth, invitations, failed/duplicate signup, first and later publications, reloads and multiple tabs. Complete the confirmation/OAuth event gap before calling GA4 registrations comprehensive.
5. Separately design a consent-respecting GA4 payment event triggered by verified Creem webhook state with durable deduplication. Do not send emails, user IDs or waiver IDs to GA4. This task does not change schemas/webhooks.

## Reporting limits

Attribution is first observed **after consent**, not necessarily the original visit. It expires in 30 days, is browser-local, and is absent when storage/consent is denied. Clearing the referrer in manual GA pageviews minimizes leakage, while the coarse acquisition dimensions provide the reviewed source evidence. Do not equate these custom dimensions with GA4's native session acquisition attribution or promise cross-device joins.

No GSC/GA4 protected account was connected for this task. Property event counts, key events, filters and actual conversion delivery remain unverified. Keep the analytics PR separate until the owner approves the measurement rollout and tests above.
