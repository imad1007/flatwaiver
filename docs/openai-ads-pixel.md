# OpenAI Ads Measurement Pixel and completed registration

Updated September 25, 2026. Local changes only; no deployment or live events.

The root layout mounts OpenAIPixel once. Next.js Script uses a stable ID and
afterInteractive loading across all routes. The exact Ads Manager SDK URL,
Pixel ID Wdj4prj2rJhsBuYu2cLejz and requested debug:true remain unchanged.
Production environment and OPENAI_ADS_PIXEL_ENABLED=true are still required.
Optional-cookie consent gates SDK loading and registration measurement.
Withdrawal uses the documented consent command.

## When registration fires

After SDK initialization, the component checks only completed-setup destinations:
dashboard, settings/billing, waivers/new and a waiver UUID editor URL.
These pages do not themselves establish a conversion. The browser POSTs to
/api/ads/registration; only an eligible server-side candidate returns an event ID.

The existing bootstrap creates candidates only for a newly created business,
after organization, owner profile and subscription bootstrap succeed.
Invited members and existing profiles do not create candidates. The existing
0019 RPC requires confirmed email, owner role, completed business name and a
subscription row. Candidates expire after seven days. Candidate persistence is
independent of consent and the production feature flag, while external delivery
still requires both. This prevents a signup completed before consent or config
initialization from losing its pending conversion.

The browser then calls:
oaiq("measure", "registration_completed", { type: "customer_action" },
     { event_id: serverReturnedUuid });

No signup view, failed validation/authentication, ordinary existing account
login, public signer, checkout or subscription event is measured. A qualifying
unclaimed new-business candidate can be measured later within its seven-day
window if consent is granted then. This is delayed registration measurement,
not a login event.

## Delivery lifecycle, reliability and privacy

The component waits until the initialization queue exists, then rechecks
consent and route lifetime after the reservation returns. The reservation does
not consume the event. Multiple renders, tabs and retries receive the same
stable UUID. Only after the browser queues the documented measure call does it
PATCH the endpoint to record delivery_queued_at. A blocked SDK call, navigation
before queueing, or failed acknowledgment leaves the same ID available for a
later retry. OpenAI deduplicates repeat deliveries by Pixel ID, event name and
event_id, so concurrent tabs remain one logical conversion.

The previous flow updated claimed_at during the initial POST. A component
cleanup, navigation or competing request could therefore consume the candidate
before the browser called measure; every later POST correctly found no pending
candidate and returned 204. Migration 0022 adds the reserve/complete lifecycle
and makes the legacy claim RPC non-destructive during rollout. Existing rows
lost to claimed_at can retry their original event ID.

Blocked requests and SDK errors cannot break signup. delivery_queued_at records
a reasonable browser queue attempt, not confirmed network receipt.
The supplied event_id identifies the same event using the documented options
argument. No user data, waiver text or signature is explicitly included.

The globally loaded SDK is not isolated from page DOM. Automatic advanced
matching, when enabled, is SDK behavior; this code does not disable it.
Consent withdrawal cannot unload previously executed third-party JavaScript.
GA4, billing, authentication and unrelated analytics are unchanged.

## Deployment and verification (not performed)

Confirm migrations 0019_registration_measurement.sql and
0022_registration_measurement_delivery.sql are applied in order. Keep the
existing production flag enabled.
After authorized deployment, open Ads Manager Event Stream for this Pixel.
Accept optional cookies, create a new business account, confirm email and
complete setup. Expect registration_completed with customer_action and a
UUID event_id. Refresh and log in again: no second registration event.
Failed signup, existing accounts and denied consent must not send an event.
Do not claim live measurement until receipt has been observed.

Checks:
- node scripts/verify-openai-sdk-setup.mjs
- node --experimental-strip-types scripts/verify-openai-pixel.mjs
- focused lint, TypeScript, production build, git diff --check

Tests mock SDK/network and execute the real reservation/completion SQL in
PGlite. They cover new and existing accounts, readiness, consent, route
exclusions, stable IDs across concurrent requests, recovery of old eager
claims, successful acknowledgment, user isolation, exact arguments and
transport failures.

Official reference:
https://developers.openai.com/ads/measurement-pixel
