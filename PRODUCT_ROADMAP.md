# FlatWaiver product roadmap

Updated: September 6, 2026

This roadmap is based on the current repository, its production build, and the
documented product architecture. Browser-level review remains outstanding
because no browser automation surface was available during this audit.

## Verified baseline

- The production build compiles and all 56 discovered routes generate.
- ESLint passes with no reported errors.
- The core product surfaces exist: onboarding, waiver creation and publishing,
  public/mobile signing, kiosk mode, signature search/detail, downloads, CSV and
  PDF export, renewals, team access, branding, billing, API keys, and webhooks.
- Publishing appends a `template_versions` row and points the template at the new
  version; it does not update an existing version.
- Public waiver loading and submission run through server-side admin clients.
- Existing signature viewing and export routes are not hidden by the billing
  gate. Creation, publishing, and public acceptance are gated.
- The guarded development signing flow passes against the configured test
  project. It verifies persistence, conditional-field validation, exact version
  pinning, consent snapshotting, organization-prefixed private storage paths,
  signing-channel persistence, stored PDF content, and the stored PDF SHA-256
  hash.

## Priorities

### P0 — trust and journey reliability

1. Run the real create → publish → share → mobile sign → email/download → search
   journey against an isolated Supabase test project.
   - Success: every step completes on 360 px and desktop layouts; the resulting
     row pins the published version; the stored PDF hash matches its bytes.
2. Add automated journey coverage that creates disposable organizations and
   templates without mutating immutable production evidence.
   - Success: CI covers happy path, minor/guardian, conditional fields, expired
     subscription rejection, and post-cancellation retrieval/export.
3. Verify billing-provider configuration matches `APP.priceMonthlyUsd` before
   checkout starts.
   - Implemented: the active Creem product is retrieved immediately before
     checkout and must be active, recurring monthly, USD, and exactly match the
     configured public price. Any contradiction fails closed with an
     operator-visible diagnostic. Deterministic matching and mismatch checks
     pass; a live provider call remains an environment verification step.

### P1 — activation and simplicity

1. Measure signup → first published waiver → first signature as one funnel.
   - Progress: consent-respecting events now cover creation-method choice, import
     start/success/failure, onboarding completion, draft save, and publish. Event
     parameters are limited to coarse method, file type/size bucket, counts,
     failure category, and version number; they exclude names, emails, waiver
     text, filenames, signer data, and record IDs.
   - Implemented: append-only organization milestones are recorded atomically by
     database triggers on the first actual publication and committed signature,
     with an existing-data backfill. The platform-admin overview exposes counts,
     conversion percentages, and median signup-to-publish/signature time. Live
     verification remains pending application of migration 0014.
2. Reduce first-waiver setup friction using contextual next actions and preserve
   draft progress across recoverable failures.
   - Implemented locally: exact draft/share next actions, tab-scoped recovery,
     source-backed AI-import fallback, and atomic publishing. Live browser and
     Supabase journey evidence remains listed below.
3. Add empty, loading, failure, and recovery states to each primary collection
   and editor surface.
   - Implemented locally for the primary dashboard, waiver, signature, renewal,
     check-in, settings, editor, sharing, download, and authenticated-shell
     paths. Browser interaction evidence remains listed below.

### P2 — customer confidence and growth

1. Assign a product owner and quarterly review reminder for the dated,
   source-linked comparative pricing dataset.
2. Add genuine customer proof when permissioned; keep the section hidden until
   real testimonials exist.
3. Establish accessibility and performance budgets for marketing and signing.
   - Success: keyboard-only completion, visible focus, labelled errors, 200% text
     zoom support, and agreed Core Web Vitals thresholds on representative phones.

## Completed in this audit

- Corrected stale `$39` setup documentation to the canonical `$19` price.
- Routed FlatWaiver-owned homepage and admin price copy through
  `APP.priceMonthlyUsd`, reducing the chance of future checkout/marketing drift.
- Replaced competitor estimates with discrete, dated, source-linked public plan
  data and removed the unverified WaiverForever 1,000-use total.
- Repaired the dev signing harness contract so `ALLOW_DEV_SEED=true` permits its
  documented dummy Turnstile token while production continues to verify every
  token remotely.
- Expanded and passed the signing evidence assertions without increasing the
  harness's two-record-per-run footprint.
- Added guarded coverage for incomplete and complete minor/guardian submissions.
  Static checks pass; the live assertions still require an authorized networked
  development-server run and will increase the harness footprint to three
  immutable records per run.
- Made public signing recover from transport failures without losing entered
  data or leaving the submit control permanently disabled. Submission errors are
  now assertively announced and receive keyboard focus; Turnstile is reset for a
  safe retry, duplicate submits are ignored, and photo processing blocks submit.
- Added a phone-specific signature-record layout so staff can scan signer,
  waiver, time, channel, minor status, and flags without a compressed six-column
  table. Database failures now show an honest recovery state instead of looking
  like an empty account.
- Made signed-PDF downloads recover from network failures, validate the signed
  URL response, announce errors accessibly, and use a browser-compatible link
  activation after the asynchronous URL request. The download endpoint remains
  independent of subscription status.
- Added real draft dirty-state tracking to the waiver editor. The save bar now
  distinguishes saved from unsaved work, disables redundant saves, warns before
  closing or reloading, and confirms before following the editor's navigation
  links. Successful save and immutable publish operations reset the saved
  baseline only after the server confirms completion.
- Made AI document conversion recover from transport failures without losing the
  selected source file, reject malformed success responses, ignore duplicate
  submits while working, and focus an accessible error message for retry.
- Removed unusable links and QR codes from draft and archived waiver share pages;
  customers now get a direct review/publish or restore action. Copying links has
  a permission-compatible fallback and an explicit manual-copy error state.
- Email sharing now preserves the recipient address after failure, exposes an
  accessible inline retry message, and refuses to send a signing link while the
  subscription gate would prevent that signer from completing it.
- Added stable, privacy-safe activation events for onboarding and waiver creation,
  gated by the existing analytics consent mechanism and disabled on signer pages.
- Hardened legal-record exports against silent incompleteness. CSV template and
  version lookups are deterministically paginated beyond provider row limits;
  missing lookups or later-page query failures abort the stream. PDF ZIP export
  now fails the whole request when any authorized source PDF is missing or has
  an invalid organization prefix instead of returning a plausible partial ZIP.
  Neither export path checks subscription status.
- Added partial signer-email search alongside name search, with exact filter
  parity across list results, pagination, CSV export, and PDF ZIP export. The
  search input uses an email-optimized mobile keyboard without requiring a full
  syntactically valid address, so staff can search from incomplete information.
- Added request-scoped cleanup for signing failures before the append-only row is
  committed. Invalid photos are rejected before uploads begin; later guardian,
  photo, PDF-render, or PDF-upload failures remove only artifacts created under
  that request's new UUID. A reported row-insert failure is reconciled by UUID:
  cleanup occurs only when the database proves no row exists, while committed or
  uncertain outcomes retain every evidence file. Committed evidence therefore
  remains immutable and is never regenerated.
- Added equivalent failure atomicity to AI imports: when both conversion attempts
  fail or the draft row cannot be inserted, the newly uploaded private source is
  removed on a best-effort basis. Once a template references the source path, the
  cleanup path is unreachable and the original document is retained.
- Made onboarding completion and pasted-text draft creation recover from thrown
  server/network failures while preserving every customer choice and text field.
  Text-draft creation now returns its confirmed draft ID and navigates client-side
  instead of relying on a thrown framework redirect, enabling an accessible inline
  retry state and a distinct privacy-safe `waiver_draft_created` milestone.
- Made waiver lifecycle mutations prove that a row was actually affected before
  reporting success. Draft save, publish activation, archive, restore, renewal,
  and photo-policy updates now reject zero-row/RLS misses; archive and restore UI
  actions catch those failures instead of producing unhandled transitions. A rare
  post-version publish failure explicitly tells the operator to contact support
  before retrying, avoiding silent immutable-version churn.
- Neutralized spreadsheet formula injection in CSV exports. Every untrusted cell
  is centrally encoded; values whose first meaningful character is `=`, `+`, `-`,
  or `@` are forced to literal text before standard quote/newline escaping. A
  deterministic six-case verification command covers ordinary, quoted,
  multiline, leading-whitespace, and formula-like values.
- Added backward-compatible signing idempotency. The form keeps one random UUID
  across retries, the server uses it as the append-only record ID, and a retry of
  an already committed submission for the same waiver returns success before rate
  limiting or storage writes. Kiosk reset mints a new ID for the next signer.
  The guarded flow now asserts that a repeated request leaves exactly one row;
  its live run remains pending authorized external test access.
- Closed the active billing price-integrity gap. Creem checkout now validates
  the provider's current product amount, currency, cadence, billing type, and
  status against the canonical FlatWaiver offer before creating a hosted
  session. Configuration contradictions fail closed and are logged with exact
  operator diagnostics, while customers receive a safe service message. The
  billing button now also recovers accessibly from transport failures. A
  deterministic three-scenario verifier covers the comparison contract.
- Tightened the unauthenticated signing boundary before any evidence upload.
  Signature and guardian-signature data URLs now have encoded-size limits at
  schema validation, impossible calendar dates are rejected rather than being
  left to a later database cast, and a rate-limit query failure fails closed
  with a retry response instead of silently disabling protection. The server
  also rejects forged photo uploads when the business has configured photo
  capture off, preventing unintended collection of sensitive images. Strict
  date validation has deterministic leap-year and malformed-date coverage.
- Replaced false empty and missing-record states on core management reads.
  Waiver lists and all seven dashboard queries now surface a consistent,
  accessible retry panel on database failure; signature detail distinguishes a
  transient query failure from a genuine 404 and warns separately when version
  metadata or a captured photo cannot be loaded. Renewal screens and the daily
  reminder scan now fail honestly instead of claiming everyone is current.
- Removed the renewal scanner's silent 5,000-signature ceiling. Renewal-enabled
  templates, signatures, and reminder-ledger rows are now fetched in deterministic
  pages and bounded filter chunks, with every query failure propagated. Latest-
  signature deduplication is performed only after the complete result set is
  globally ordered, preserving correct renewal status for larger customers.
- Added phone-native waiver-management and recent-activity cards while retaining
  denser tables at desktop widths. Core names, states, dates, channels, flags,
  and next actions remain readable without horizontal compression.
- Made renewal email delivery idempotent across manual clicks, concurrent calls,
  and scheduled runs. Both paths now share one delivery function, consult the
  reminder ledger first, and send Resend a stable key derived from the immutable
  signed-waiver ID before recording acceptance. Duplicate requests report
  “already sent” rather than claiming a new send. Stable-key behavior has four
  deterministic assertions.
- Corrected transactional email result handling. The Resend SDK returns provider
  rejections as an `error` value rather than necessarily throwing; signer-copy,
  owner, flagged-signature, renewal, team-invite, and signing-invite paths now
  inspect that result. Best-effort notifications log failures, while user-driven
  sends surface them instead of reporting false success.
- Made the read API usable for complete signature histories. `GET
  /api/v1/signatures` now offers stable descending cursor pagination using the
  immutable record ID plus signing timestamp, fetches one look-ahead row, and
  returns `has_more` with `next_cursor`. Limit, cursor, template, tag, and ISO
  date inputs are bounded and validated with customer errors instead of database
  failures. The developer screen explains continuation, and three deterministic
  scenarios cover page-boundary shaping.
- Hardened integration failure semantics. Signature-detail API reads distinguish
  query failure from not-found and fail explicitly when a private PDF URL cannot
  be issued. Developer settings no longer render failed API-key or webhook reads
  as empty lists. Key revocation and webhook deletion/toggling now verify both
  organization scope and the affected row before reporting success.
- Closed the outbound-webhook SSRF path. Registration now requires a credential-
  free HTTPS URL whose hostname resolves exclusively to public addresses, and
  every delivery repeats DNS/address validation so a later hostname change is
  not trusted. Loopback, private, link-local, carrier-grade NAT, documentation,
  multicast/reserved IPv4, IPv6 local/link-local/multicast/documentation, and
  IPv4-mapped private addresses are blocked. Redirects are not followed, so a
  public endpoint cannot bounce delivery into an internal service. Eighteen
  deterministic public/reserved address cases pass.
- Added an authoritative, privacy-safe activation funnel. Migration 0014 records
  only organization ID, milestone, occurrence time, and source UUID for first
  publication and first signature; database triggers tie each event to the
  transaction that creates the real outcome. Rows are unique per organization,
  append-only, and existing customers are backfilled from version/signature
  history. A security-invoker aggregate view powers admin conversion counts and
  median time-to-value without exposing signer identity or waiver content. The
  migration contract verifier confirms atomic triggers, immutability, uniqueness,
  view security, and absence of sensitive columns.
- Removed the pointer-only signature barrier. Signers and guardians can now
  choose an accessible radio-controlled Draw or Type method; typed signatures
  are rendered into the same immutable PNG evidence artifact and visibly appear
  in the signed PDF. The drawing mode explains its keyboard alternative, and
  photo upload is keyboard-focusable with a visible focus treatment. Typed input
  validation covers whitespace, maximum length, Unicode, and legitimate single-
  character names; server identity validation now permits those names as well.
- Secured and simplified account activation. Login, email confirmation, and
  Google OAuth now share a same-origin redirect validator that rejects protocol-
  relative, backslash, encoded, malformed, and control-character payloads.
  Invite signup preserves its destination and email, removes owner-only setup
  questions, hints the correct Google account, and reports transient failures as
  failures instead of invalid invitations. Bootstrap database reads now fail
  closed, owner trials self-repair without overwriting billing state, invite
  acceptance reconciles after partial failures, and concurrent signup cleans up
  only the exact orphan organization it created.
- Made team administration fail closed and report outcomes honestly. Team and
  audit queries now show a recoverable load error instead of empty state during
  outages; IDs are validated; every member/invitation lookup and mutation is
  organization-scoped; and role changes, removals, and revocations verify the
  affected row before success or audit logging. Failed invitation delivery rolls
  back its undelivered token, role selectors revert after failed updates, and
  unknown database roles now normalize to read-only viewer instead of staff.
- Hardened first-session and organization settings reliability. Transient auth,
  profile, organization, branding, and subscription read failures are no longer
  interpreted as logout, missing setup, default branding, or an inactive plan.
  Business identity and branding mutations now require owner/admin authority and
  verify the organization row changed; lower roles see clear read-only guidance.
  Onboarding reports trial and starter-template failures instead of claiming
  success, authenticated route failures have an accessible retry screen, and
  logo replacement saves a unique new asset pointer before safely cleaning up
  the old file so failed writes cannot leave a broken logo reference.
- Made plan management provider-aware and webhook-honest. Subscription read
  failures now show recovery instead of a phantom trial, only owners/admins see
  actionable billing controls, and existing Creem or legacy Stripe customers
  reach the matching portal. Checkout success parameters never grant or claim
  access; the page waits for authoritative webhook state and refreshes briefly.
  Both active and dormant provider endpoints enforce roles, scope subscription
  reads to the caller's organization, distinguish provider/data failures, and
  prevent already-active customers from starting a duplicate subscription.
- Hardened front-desk and shared-tablet workflows. Public template, immutable
  version, organization, and subscription query failures now return an honest
  retryable service state (including HTTP 503 on submission) instead of looking
  like a missing waiver or lapsed customer. Kiosk forms explain shared-device
  privacy, disable autocomplete, offer immediate clearing, wipe abandoned data
  after three idle minutes, and reset five seconds after success. Front-desk
  searches bound input and fail visibly on any source-query error; check-in and
  undo are staff-only, validate IDs, confirm organization ownership, suppress
  same-day retries, and verify affected rows without touching signed evidence.
- Added a dependable first-party support path while preserving direct email.
  When Resend and Turnstile are configured, customers get a bounded, accessible
  contact form with signed-in email prefill, topic routing, a privacy warning,
  bot honeypot, explicit challenge verification, a 20-second network timeout,
  and retry/reset behavior. User text is HTML-escaped, replies target the
  validated customer address, and success appears only after the mail provider
  accepts the request with an optional reference; delivery failures retain a
  visible mailto fallback instead of losing or falsely acknowledging the issue.
- Improved narrow-screen navigation and operational data access after a
  responsive source audit. Settings tabs now remain reachable through contained
  horizontal scroll with snap points and current-page semantics; front-desk and
  renewal tables preserve readable column widths, expose accessible captions and
  column scopes, and scroll instead of clipping. Redundant support/quick-action
  header icons hide at the narrowest breakpoint (both remain in navigation),
  preserving room for the menu, page context, alerts, and account control.
- Replaced stale, interpolated competitor-price claims with a single dated
  pricing dataset linked to each provider's public source. The homepage now uses
  only discrete published tiers, omits an unverifiable WaiverForever 1,000-use
  total, scopes the calculator to directly comparable volumes, and discloses
  discounts, taxes, add-ons, overages, and feature differences. A focused
  contract verifier prevents the table and calculator from drifting apart.
- Made first-waiver editing resilient to reloads and recoverable failures.
  Scratch input and unsaved editor changes now keep a tab-scoped backup, the
  editor validates stored data before offering restore/discard controls, and a
  successful save or publish clears the backup. Migration 0015 publishes the
  immutable version and advances the live template pointer in one locked
  transaction, while the editable draft is saved first for safe retry.
- Preserved AI-import work before conversion begins. The private original and a
  manual-review draft now exist before the model call; unreadable Word files,
  repeated conversion failures, and converted-draft update failures route the
  customer into that draft instead of deleting the upload. Editors can open the
  original through the existing organization-checked signed-URL flow.
- Made management data failures explicit instead of destructive-looking. The
  authenticated shell now stops before false logout/onboarding/billing states
  when auth, profile, organization, subscription, or notification queries fail.
  Waiver editor/version and sharing failures offer safe retries; signature
  results also fail visibly when waiver labels and filters cannot load. A shared
  accessible App Router loading skeleton now provides immediate navigation
  feedback while page data streams.
- Shortened activation clicks from the dashboard. The publish checklist opens
  the first actual draft, while first-signature guidance and the empty activity
  state open the first published waiver's sharing screen instead of sending new
  customers to a generic list.
- Distinguished subscription-service outages from inactive plans during pasted
  waiver creation, publishing, and AI import. Transient query failures now say
  nothing changed (or that the file was not uploaded) and invite retry; only an
  authoritative unusable status produces the billing message.
- Kept staff on the signature-management screen during CSV and PDF-ZIP exports.
  Filter-preserving client downloads now validate HTTP success and non-empty
  output, use server filenames safely, release object URLs, disable duplicate
  requests, and show an accessible retry error instead of navigating to JSON.

## Evidence still required

- Browser screenshots and interaction checks at mobile and desktop breakpoints.
- A live pass of the new minor/guardian signing assertions against the isolated
  development project.
- Delivery logs for signer and owner emails, Stripe/Creem webhook replay checks,
  and accessibility testing with a real browser and assistive technology.
- A live Creem checkout attempt confirming the configured product passes the new
  price-integrity guard in the intended test and production environments.
- Application and data checks after applying migration 0014, confirming the
  backfilled activation counts and new first-occurrence triggers in Supabase.
- A live concurrent publish/retry check after applying migration 0015 in the
  development Supabase project.
