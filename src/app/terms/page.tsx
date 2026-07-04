import type { Metadata } from "next";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Terms of Service | ${APP.name}`,
};

export default function TermsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated: July 4, 2026</p>

        <div className="mt-8 space-y-6 leading-relaxed text-neutral-700">
          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              1. What {APP.name} is
            </h2>
            <p className="mt-2">
              {APP.name} is a document-signing tool. It converts your existing waiver
              documents into digital forms, collects electronic signatures, and stores
              the signed records with supporting evidence. {APP.name} does not write,
              review, or validate the legal content of your waivers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              2. Your content, your responsibility
            </h2>
            <p className="mt-2">
              You own the waiver content you upload or paste, and you are solely
              responsible for it. AI-assisted conversion produces a draft that you
              must review before publishing; you are responsible for verifying that
              the published text matches your intended legal language.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              3. No legal advice
            </h2>
            <p className="mt-2">
              Nothing in the service, its documentation, or its marketing constitutes
              legal advice. Whether a waiver is enforceable depends on its content and
              your jurisdiction. Have a lawyer review your waiver text.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              4. Electronic signatures
            </h2>
            <p className="mt-2">
              Signatures collected through the service include an electronic-signature
              consent acknowledgment consistent with the federal ESIGN Act and UETA.
              Each signed record stores the consent text shown, signer identity
              details, timestamp, IP address, and an integrity hash of the signed
              document.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              5. Prohibited use — healthcare
            </h2>
            <p className="mt-2">
              The service is not designed for, and must not be used to collect or
              store, protected health information. {APP.name} is not a HIPAA business
              associate and does not offer HIPAA-compliant features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              6. Billing and trial
            </h2>
            <p className="mt-2">
              The service costs ${APP.priceMonthlyUsd}/month, flat, after a{" "}
              {APP.trialDays}-day free trial. Unlimited signed waivers, templates, and
              storage, subject to fair use: automated abuse (e.g., spam submissions)
              may be blocked. If your subscription lapses, collection of new
              signatures is paused — but you can always view, search, download, and
              export the waivers you already collected. We never withhold your legal
              records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              7. Acceptable use
            </h2>
            <p className="mt-2">
              You may not use the service for unlawful purposes, to collect
              signatures deceptively, or to attempt to alter or forge signed records.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              8. Disclaimer and limitation of liability
            </h2>
            <p className="mt-2">
              The service is provided &ldquo;as is.&rdquo; To the maximum extent permitted by
              law, {APP.name} disclaims all warranties and is not liable for indirect,
              incidental, or consequential damages. Our total liability is limited to
              the fees you paid in the twelve months before the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">9. Contact</h2>
            <p className="mt-2">
              Questions:{" "}
              <a className="underline" href={`mailto:${APP.supportEmail}`}>
                {APP.supportEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
