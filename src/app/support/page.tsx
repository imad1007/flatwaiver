import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SUPPORT_FAQS as FAQS } from "@/lib/support-faqs";
import { Mail } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { createClient } from "@/lib/supabase/server";
import { APP } from "@/lib/config";
import { SupportForm } from "@/components/support-form";

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

  if (user) redirect("/help");

  const mailto = `mailto:${APP.supportEmail}?subject=${encodeURIComponent(
    `${APP.name} support request`
  )}`;
  const formConfigured = Boolean(
    process.env.RESEND_API_KEY &&
      process.env.TURNSTILE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );

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
          {formConfigured && <SupportForm />}
          <a
            href={mailto}
            className={`${formConfigured ? "mt-5 border border-input bg-background text-foreground hover:border-ring" : "bg-primary text-primary-foreground hover:bg-primary/90"} inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors`}
          >
            <Mail className="size-4" />
            {formConfigured ? "Prefer email? Write directly" : `Email ${APP.supportEmail}`}
          </a>

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
