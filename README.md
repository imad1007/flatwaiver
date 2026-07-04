# FlatWaiver

Flat-rate digital waiver SaaS: **unlimited waivers, $39/month, flat.** Upload the
PDF waiver you already use → AI converts it to a signable digital form → live
signing link + QR in under 5 minutes.

Branding lives in one place: [`src/lib/config.ts`](src/lib/config.ts) — renaming
the product is a one-line change.

## Stack

- **Next.js (App Router, TypeScript)** on Vercel
- **Supabase** — Postgres + Auth (password + magic link) + private Storage
- **Stripe** — one $39/mo subscription (Checkout + Customer Portal + webhooks)
- **Resend** — transactional email
- **Anthropic API** — PDF → structured waiver conversion (`claude-sonnet-4-6`, temp 0)
- **@react-pdf/renderer** — signed-PDF generation (Node runtime only)
- **Cloudflare Turnstile** — bot protection on the public signing endpoint

## Three non-negotiable architecture rules

1. **Immutable versioning.** Waiver text is never edited in place. Every publish
   creates a new row in `template_versions`; a signed waiver references the exact
   version it was signed against, forever. Enforced by DB triggers, not just app code.
2. **Evidence-grade signatures.** Every signature captures UTC timestamp, IP,
   user agent, the exact consent text shown, a drawn signature image, typed legal
   name, and a SHA-256 hash of the final rendered PDF. The PDF is stored and never
   regenerated. `signed_waivers` is append-only (DB trigger).
3. **Service-role boundary.** Anonymous signers never talk to Supabase directly.
   All public operations go through Next.js route handlers running the
   service-role client with strict zod validation. RLS denies `anon` everything.

## Setup

1. **Supabase project** — run the migrations in `supabase/migrations/` in order
   (SQL editor or `supabase db push`). This creates the schema, RLS policies,
   immutability triggers, and the three private storage buckets
   (`uploads`, `signatures`, `signed-pdfs`).
2. **Env vars** — copy `.env.example` to `.env.local` and fill everything in.
3. **Stripe** — create one recurring $39/mo price, put its id in `STRIPE_PRICE_ID`.
   Point a webhook at `POST /api/stripe/webhook` with events
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`; put the signing secret in `STRIPE_WEBHOOK_SECRET`.
4. **Turnstile** — create a widget for your domain; keys go in
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`.
5. **Resend** — verify your sending domain; emails send from
   `notifications@<your-app-domain>`.

```bash
npm install
npm run dev
```

## Route map

| Area | Routes |
|---|---|
| Marketing | `/`, `/privacy`, `/terms`, `/login`, `/signup` |
| App | `/dashboard`, `/waivers`, `/waivers/new`, `/waivers/[id]`, `/waivers/[id]/share`, `/signatures`, `/signatures/[id]`, `/settings/billing` |
| Public signing | `/w/[slug]`, `/w/[slug]/done`, `/kiosk/[slug]` |
| API (Node) | `POST /api/ai-import`, `POST /api/sign/[slug]`, `POST /api/stripe/{checkout,portal,webhook}`, `GET /api/signatures/export`, `POST /api/files/sign-url` |

## Billing behavior

Card-free 14-day trial starts at signup. A lapsed subscription pauses **new**
signatures and template publishing only — viewing, searching, downloading, and
exporting existing signed waivers always work. Legal documents are never held
hostage.

## Data deletion (operator runbook note)

`template_versions` and `signed_waivers` are append-only at the DB level; even
the service role cannot UPDATE/DELETE them. Deletion requests (privacy/GDPR)
are an operator action in v1: connect as the Postgres superuser (Supabase SQL
editor runs as `postgres`), drop the trigger, delete the rows and the
corresponding storage objects, re-create the trigger, and log the action.
Requests arrive via the support email in `src/lib/config.ts`.
