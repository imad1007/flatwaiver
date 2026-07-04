<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FlatWaiver — agent guidance

Flat-rate digital waiver SaaS (Next.js App Router + Supabase + Stripe + Resend +
Anthropic). Full product spec conventions below; see `README.md` for setup.

## Three non-negotiable architecture rules (never "simplify" these away)

1. **Immutable versioning** — waiver content lives only in `template_versions`
   (append-only, DB-trigger enforced). Publishing creates a new version; nothing
   ever edits or deletes an existing version. Signed waivers pin the exact
   `template_version_id` forever.
2. **Evidence-grade signatures** — `signed_waivers` is append-only. The signed
   PDF is rendered once (double-render SHA-256 stamping in
   `src/lib/pdf/waiver-pdf.tsx`), stored in the private `signed-pdfs` bucket, and
   never regenerated.
3. **Service-role boundary** — anonymous signers never touch Supabase directly.
   Public operations go through route handlers using `createAdminClient()`
   (`src/lib/supabase/admin.ts`, server-only) with zod validation. RLS gives
   `anon` zero policies. Authenticated app pages use the SSR anon client
   (`src/lib/supabase/server.ts`) so RLS scopes rows to the user's org.

## Conventions

- Branding/config: `src/lib/config.ts` only (`APP.name` etc.).
- All API routes are Node runtime (`export const runtime = "nodejs"`);
  @react-pdf/renderer must never run on Edge.
- Storage buckets (`uploads`, `signatures`, `signed-pdfs`) are private; files are
  served via 10-min signed URLs from `POST /api/files/sign-url` after an
  org-prefix check (all paths start with `<org_id>/`).
- Billing gate: `subscriptionIsUsable()` (trialing|active) is required to
  create/publish templates and accept signatures. **Never** gate viewing,
  searching, downloading, or exporting existing signed waivers.
- Migrations live in `supabase/migrations/` and are ordered; `0001`–`0002` are
  the spec schema/RLS verbatim — don't edit them, add new numbered files.
- Auth bootstrap (`src/lib/bootstrap.ts`) runs idempotently in the `(app)`
  layout; signup metadata carries `business_name` + `waiver_volume_band`.

## Commands

- `npm run dev` / `npm run build` / `npm run lint`
- No test suite yet; verify with `npm run build` + manual flows.
