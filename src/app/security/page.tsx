import type { Metadata } from "next";
import { FileCheck2, Lock, ShieldCheck, Unplug } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Security & Evidence | ${APP.name}`,
  description:
    "How FlatWaiver produces court-ready waiver records: tamper-evident hashes, immutable versioning, encryption, and your unconditional right to export.",
};

const PILLARS = [
  {
    icon: FileCheck2,
    title: "Tamper-evident by construction",
    body: `Every signed waiver is rendered to PDF exactly once, at the moment of signing. A SHA-256 fingerprint of the document is stamped into the PDF itself and recorded in our database. Recompute the hash of the file at any time — in court, for an insurer, years later — and compare it to the recorded value. If a single byte had changed, the hashes wouldn't match.`,
  },
  {
    icon: ShieldCheck,
    title: "Immutable records, immutable waiver text",
    body: `Signed records are append-only: not even we can edit or delete them — the database itself rejects updates. Waiver text is versioned the same way. Every signature is permanently pinned to the exact version of the exact words the signer saw, along with the consent statement they agreed to, their IP address, device, and a timestamp.`,
  },
  {
    icon: Lock,
    title: "Encrypted and access-controlled",
    body: `All data is encrypted in transit (TLS) and at rest. Signed documents and signature images live in private storage that is never publicly listable — files are served only through short-lived signed URLs, only to authenticated members of your business, only for your own records. Signers never get direct database access; every public submission passes through server-side validation and bot protection.`,
  },
  {
    icon: Unplug,
    title: "Your data is never hostage",
    body: `Export everything, any time: CSV of all records and bulk ZIP downloads of every signed PDF, in the app, with no volume caps and no "storage plan" fees. Exporting and viewing your existing records is never gated on your subscription — if you cancel, your signed waivers remain viewable and downloadable. Compare that to per-waiver vendors before you trust them with legal documents.`,
  },
];

export default function SecurityPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Security &amp; evidence
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Built like a system of record, because it is one
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          A waiver only matters on the worst day of your year. Here is exactly how{" "}
          {APP.name}
          {" makes sure the record holds up — and why you’re never locked in."}
        </p>

        <div className="mt-10 space-y-8">
          {PILLARS.map((p) => (
            <section key={p.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-600 dark:text-brand-300">
                  <p.icon className="size-4.5" />
                </span>
                <h2 className="text-xl font-semibold">{p.title}</h2>
              </div>
              <p className="mt-3 leading-relaxed text-foreground/90">{p.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">What we build on</h2>
          <p className="mt-2 leading-relaxed text-foreground/90">
            {APP.name} runs on audited, industry-standard infrastructure: Supabase
            (database, authentication, and encrypted storage), Stripe (payments — we
            never see or store card numbers), Resend (transactional email), and
            Cloudflare Turnstile (bot protection on public signing pages). Electronic
            signatures collected through {APP.name} are recognized in the United
            States under the federal ESIGN Act and UETA; every signer affirmatively
            consents before signing, and the exact consent text is stored with the
            record.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Questions about our security practices, data handling, or a specific
            compliance requirement?{" "}
            <a href={`mailto:${APP.supportEmail}`} className="underline underline-offset-2 hover:text-foreground">
              {APP.supportEmail}
            </a>{" "}
            — we answer these personally. This page is not legal advice; have a lawyer
            review your waiver text.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
