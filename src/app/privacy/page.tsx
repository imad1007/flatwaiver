import type { Metadata } from "next";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP.name}`,
};

export default function PrivacyPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-neutral-500">Last updated: July 4, 2026</p>

        <div className="prose-neutral mt-8 space-y-6 leading-relaxed text-neutral-700">
          <section>
            <h2 className="text-xl font-semibold text-neutral-900">Who we are</h2>
            <p className="mt-2">
              {APP.name} is a digital waiver signing service operated for businesses
              (&ldquo;organizations&rdquo;) that collect signed liability waivers from their
              customers (&ldquo;signers&rdquo;). This policy describes what we collect from
              both groups and how it is handled.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              Information we collect
            </h2>
            <p className="mt-2">
              <strong>From organization accounts:</strong> email address, password
              (hashed), business name, approximate monthly waiver volume, and billing
              information processed by Stripe. We do not store card numbers.
            </p>
            <p className="mt-2">
              <strong>From signers:</strong> when you sign a waiver we collect the
              personal information the waiver form requests, which typically includes
              your name, email address, date of birth, guardian details for minors,
              your drawn signature image, your IP address, your browser user agent,
              and the date and time of signing. This information is collected because
              it forms the legal evidence record of your signature, and it is stored
              on behalf of the organization whose waiver you signed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              Electronic signature consent
            </h2>
            <p className="mt-2">
              Before signing, every signer is shown a consent statement and must
              affirmatively agree to sign electronically. Electronic signatures are
              recognized in the United States under the federal ESIGN Act and UETA.
              A copy of the exact consent text shown is stored with each signature.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              Where data is stored and who processes it
            </h2>
            <p className="mt-2">
              Data is stored in Supabase (database and file storage). We use the
              following processors to operate the service: Supabase (database,
              authentication, file storage), Stripe (payments), Resend
              (transactional email), Anthropic (AI conversion of uploaded waiver
              documents), Vercel (hosting), and Cloudflare (bot protection on the
              signing page).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">Retention</h2>
            <p className="mt-2">
              Signed waivers are legal records and are retained until the
              organization that collected them deletes its account, or until a
              deletion request is processed manually. Signed waiver records are
              stored append-only for integrity; deletion is performed by our
              operators on request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">
              Data deletion requests
            </h2>
            <p className="mt-2">
              To request deletion of your data, email{" "}
              <a className="underline" href={`mailto:${APP.supportEmail}`}>
                {APP.supportEmail}
              </a>
              . If you signed a waiver for a business, we may refer the request to
              that business, since it is the owner of the signed record.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">Contact</h2>
            <p className="mt-2">
              Questions about this policy:{" "}
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
