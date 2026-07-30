import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { createClient } from "@/lib/supabase/server";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Support & FAQ — help with ${APP.name}`,
  description: `Answers to common ${APP.name} questions: setting up your first waiver, guardian signing for minors, legal validity, finding and exporting signed waivers, cancellation, pricing, and security.`,
  alternates: { canonical: "/support" },
};

/**
 * FAQ copy is written against the real implementation:
 * - guardian flow: signing-form.tsx (under-18 checkbox → guardian name,
 *   relationship, and a separate guardian signature).
 * - export: /api/signatures/export (CSV) + /api/signatures/export-pdfs (ZIP),
 *   never gated on subscription.
 * - finding: Signatures page search by signer name + date/template/flag filters.
 * - billing gate: subscriptionIsUsable() pauses NEW signatures only; viewing
 *   and export are never gated.
 */
const FAQS: {
  q: string;
  a: string;
  link?: { href: string; label: string };
}[] = [
  {
    q: "How do I set up my first waiver?",
    a: `Upload the waiver you already use — a PDF, a photo, or a Word file — and ${APP.name} converts it into a signable digital form, preserving your wording. You review every clause, publish it, and share it as a link, a printable QR code, or on a front-desk kiosk. Most owners are collecting signatures the same afternoon.`,
  },
  {
    q: "How does signing work for minors and guardians?",
    a: "When a participant is under 18, they check the “participant is under 18” box during signing. The waiver then collects the parent or guardian's full legal name, their relationship to the minor, and a separate guardian signature — all stored on the signed record alongside the participant's details. (Whether a parent can waive a child's own claims varies by state; ask your lawyer.)",
    link: {
      href: "/blog/are-digital-waivers-legally-binding",
      label: "More on minors and enforceability",
    },
  },
  {
    q: "Are the signed waivers legally binding?",
    a: `Electronic signatures collected through ${APP.name} are recognized in the United States under the federal ESIGN Act and UETA. Every signature captures the signer's affirmative consent, the exact waiver text they saw, a timestamp, and a tamper-evident record. This isn't legal advice — the enforceability of your wording depends on your state, so have a lawyer review your waiver text.`,
    link: {
      href: "/blog/are-digital-waivers-legally-binding",
      label: "What makes a digital waiver enforceable",
    },
  },
  {
    q: "How do I find a specific signed waiver?",
    a: "Open the Signatures page in your dashboard and search by the signer's name. You can also filter by date range, by which waiver they signed, or show only flagged records (for example, a disclosed medical condition). Every result opens to the full signed PDF and its evidence details.",
  },
  {
    q: "Can I export my signed waivers?",
    a: "Yes. From the Signatures page you can export a CSV of every record and download the signed PDFs in bulk. Export is never locked behind your subscription — your legal documents are yours, so even if you cancel you can still download everything.",
  },
  {
    q: "How do I cancel, and what happens to my waivers?",
    a: "You can cancel any time from Settings → Billing. Cancelling only pauses new signatures — every waiver you've already collected stays viewable, searchable, and downloadable. We never hold your legal records hostage.",
  },
  {
    q: "How much does it cost?",
    a: `${APP.name} is a flat $${APP.priceMonthlyUsd}/month for unlimited signed waivers, unlimited templates, and unlimited storage — no per-waiver fees and no volume tiers. It starts with a ${APP.trialDays}-day free trial, and no credit card is required to try it.`,
    link: { href: "/#pricing", label: "See pricing" },
  },
  {
    q: "How is my data kept secure?",
    a: "All data is encrypted in transit and at rest. Each signed waiver is rendered once and stamped with a SHA-256 integrity hash, records are append-only so they can't be silently edited, and every organization's data is isolated at the database level. It's built to hold up as a system of record.",
    link: { href: "/security", label: "How we keep records court-ready" },
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

export default async function SupportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const mailto = `mailto:${APP.supportEmail}?subject=${encodeURIComponent(
    `${APP.name} support request`
  )}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <MarketingHeader />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Support &amp; FAQ</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Answers to the questions we hear most. Can&apos;t find what you need?
          Email us — we usually reply within one business day.
        </p>

        {/* Contact */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-card">
          <a
            href={mailto}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Mail className="size-4" />
            Email {APP.supportEmail}
          </a>
          {user?.email && (
            <p className="mt-4 text-xs text-muted-foreground/70">
              Signed in as{" "}
              <span className="font-medium text-foreground/80">{user.email}</span>{" "}
              — mention this so we can find your account fast.
            </p>
          )}
        </div>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          <div className="mt-6 space-y-6">
            {FAQS.map((faq) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <h3 className="font-semibold">{faq.q}</h3>
                <p className="mt-2 leading-relaxed text-foreground/90">{faq.a}</p>
                {faq.link && (
                  <p className="mt-3 text-sm">
                    <Link
                      href={faq.link.href}
                      className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
                    >
                      {faq.link.label} →
                    </Link>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-sm text-muted-foreground">
          Still stuck? Write to us at{" "}
          <a
            href={mailto}
            className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            {APP.supportEmail}
          </a>
          . This page is general product help, not legal advice — have a lawyer
          review your waiver text.
        </p>
      </main>
      <MarketingFooter />
    </>
  );
}
