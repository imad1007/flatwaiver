# OpenAI Ads Pixel signup measurement

Revised September 21, 2026. Local only: no deployment, migration execution,
campaign changes or live events were performed.

## Verified solution: image-tag Pixel

Official Measurement Pixel documentation describes automatic advanced matching
but does not document a client-side disable option or Ads Manager toggle. The
previous instruction to disable it was unsupported and has been removed.
`consent(false)` disables measurement; `opt_out` controls future personalization.
Neither is documented as a switch for advanced matching.

We now use the officially documented Image Tag transport, with the same Pixel
ID and registration event. This is browser Pixel measurement, not Conversions
API, and needs no API key. No SDK is downloaded or initialized. No third-party
JavaScript can inspect account forms, waiver content, signatures or signer data.
The earlier same-origin iframe was not a security boundary and was removed.

After a successful server claim the browser renders a hidden image. Its URL
contains only `pid`, `event=registration_completed`, `data[type]=customer_action`,
a random measurement UUID in `event_id`, and optional `oppref`. No `user` object,
customer identifier, email or manual identity matching is supplied. Referrer
policy `origin` sends the website origin without paths or sensitive queries.
Normal browser image requests still disclose network information such as IP
address and browser headers; this is not anonymous measurement.

## Registration, consent and attribution

Only the winning new-business bootstrap creates a candidate after organization,
owner and subscription creation. Existing accounts, invitations, failed signup
submissions and public signers create no candidate. No historical backfill is
performed. The authenticated same-origin POST claim requires consent, confirmed
email, owner role, completed business name and a subscription row. Admins are
excluded. SQL atomically claims once across tabs/devices; the image also includes
the documented deduplication ID. Migration 0019 is unchanged.

Allowed completion screens cover dashboard, billing and new/draft-template
destinations from Google onboarding. Public signing, kiosks, signed documents,
imported records and transfer pages never send this Pixel.

Image tags do not automatically capture attribution. After optional-cookie
consent on an allowed marketing/signup landing page, our code stores only the
opaque `oppref` in `fw-openai-oppref` for 30 days (Secure, SameSite=Lax, path=/).
Same-browser OAuth/email verification retains it. No SDK browser-reference
cookie is created. Withdrawal clears attribution and legacy SDK cookies and
suppresses pending unsent events. Keep ad destinations and callbacks on www.

## Deployment steps (not performed)

1. Review/apply `supabase/migrations/0019_registration_measurement.sql` if not
   already applied. Do not blindly rerun this non-idempotent migration.
2. Confirm “FlatWaiver Signup” uses `registration_completed` and Pixel
   `Wdj4prj2rJhsBuYu2cLejz`. No advanced-matching toggle is required.
3. Set `OPENAI_ADS_PIXEL_ENABLED=true` for Vercel Production only, then deploy
   when approved. `VERCEL_ENV=production` is also required. Redeploy after flag
   changes because the root layout renders the flag into the client.
4. Verify receipt before calling tracking live. No API key, campaign activation
   or budget change is needed. A future CSP must allow images from bzr.openai.com.

## Verify after authorized deployment

Open Ads Manager Conversions → Event Stream for this Pixel and listen if offered.
Create a controlled NEW business account with consent accepted, verify email in
the same browser and finish business setup. Expect one image, with no repeat on
refresh/login. Failed signup, denied consent and invitations must send none.

Inspect browser Network for the image GET to
`https://bzr.openai.com/v1/sdk/events` and its explicit fields and origin-only
Referer. Official docs say `200 image/gif` confirms ingestion, not downstream
processing. There must be no SDK/CDN request.

The official Event Stream reference explicitly describes Pixel SDK events and
does not establish image-tag visibility. Check for `registration_completed`, but
absence there alone does not prove failure. Confirm image-tag reporting with
OpenAI support if it is absent. Use a genuine ad click and conversion reporting
to verify attribution; do not invent click IDs or equate HTTP 200 with attribution.

## Limits and verification

Delivery is at-most-once: navigation, image blocking or consent withdrawal after
claiming can lose the event. Claims are not reset; there is no server resend.
Candidate-write errors do not break signup but can undercount it. Candidates
expire after seven days. No consent on landing, cleared cookies, switching
browsers/devices or non-allowlisted landing paths can lose attribution. This
transport does not promise SDK advanced matching or browser-reference behavior.

Run `node --experimental-strip-types scripts/verify-openai-pixel.mjs` to test
real SQL claims, eligibility, tenant isolation, exact outbound fields, consent
races and failures without sending live events. The old SDK browser harness in
output/ is historical and no longer verifies the current transport.
The current `output/verify-openai-image-browser.mjs` exercises the actual client
component with every network request intercepted: consent, cookie attribution,
exact outbound fields, origin-only referrer, repeats and document exclusion passed.

Official references checked September 21, 2026:
- https://developers.openai.com/ads/image-tag
- https://developers.openai.com/ads/measurement-pixel
- https://developers.openai.com/ads/api-reference/conversion-setup
