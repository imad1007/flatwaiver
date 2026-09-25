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
/api/ads/registration; only a successful server claim returns an event ID.

The existing bootstrap creates candidates only for a newly created business,
after organization, owner profile and subscription bootstrap succeed.
Invited members and existing profiles do not create candidates. The existing
0019 RPC requires confirmed email, owner role, completed business name and a
subscription row. Candidates expire after seven days. Claims are atomic and
single-use across tabs/devices. Authentication and bootstrap code are unchanged.

The browser then calls:
oaiq("measure", "registration_completed", { type: "customer_action" },
     { event_id: serverReturnedUuid });

No signup view, failed validation/authentication, ordinary existing account
login, public signer, checkout or subscription event is measured. A qualifying
unclaimed new-business candidate can be measured later within its seven-day
window if consent is granted then. This is delayed registration measurement,
not a login event.

## Reliability and privacy

The component waits until the initialization queue exists, then rechecks
consent and route lifetime after the claim returns. Blocked requests and SDK
errors cannot break signup. Delivery is at-most-once, not guaranteed: closing
the page, blocked SDK, or withdrawing consent after the atomic claim can lose
the event. Claims are not reset or retried after being consumed.
The supplied event_id identifies the same event using the documented options
argument. No user data, waiver text or signature is explicitly included.

The globally loaded SDK is not isolated from page DOM. Automatic advanced
matching, when enabled, is SDK behavior; this code does not disable it.
Consent withdrawal cannot unload previously executed third-party JavaScript.
GA4, billing, authentication and unrelated analytics are unchanged.

## Deployment and verification (not performed)

Confirm migration 0019_registration_measurement.sql is already applied.
No new migration is required. Keep the existing production flag enabled.
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

Tests mock SDK/network and execute real claim SQL in PGlite. They cover
readiness, consent, route exclusions, eligible/ineligible claims, one-use
claims, user isolation, exact arguments and transport failures.

Official reference:
https://developers.openai.com/ads/measurement-pixel
