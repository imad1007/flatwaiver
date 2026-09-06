import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Database,
  FileCheck2,
  Fingerprint,
  Lock,
  Server,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { APP } from "@/lib/config";

export const metadata: Metadata = {
  title: `Security & Evidence | ${APP.name}`,
  description:
    "How FlatWaiver keeps signed waivers court-ready: tamper-evident SHA-256 hashes, immutable records, database-level isolation, encryption, and your unconditional right to export.",
};

const TRUST_CHIPS = [
  "ESIGN & UETA recognized",
  "Encrypted in transit & at rest",
  "Tamper-evident PDFs",
  "SOC 2-audited infrastructure",
];

const PILLARS = [
  {
    icon: Fingerprint,
    title: "Tamper-evident by construction",
    body: "Every signed waiver is rendered to PDF exactly once, at the moment of signing. A SHA-256 fingerprint of the document is stamped into the PDF and recorded separately in our database. Recompute the hash of the file at any time — in court, for an insurer, years later — and compare. If a single byte had changed, the hashes wouldn't match.",
  },
  {
    icon: ShieldCheck,
    title: "Immutable records and waiver text",
    body: "Signed records are append-only: not even we can edit or delete them — the database itself rejects the change. Waiver text is versioned the same way, so every signature is permanently pinned to the exact wording the signer saw, plus the consent statement they agreed to, their IP, device, and timestamp.",
  },
  {
    icon: Lock,
    title: "Encrypted and isolated",
    body: "All data is encrypted in transit (TLS) and at rest. Your organization's records are isolated at the database level with row-level security — one business can never query another's data. Signed PDFs and signature images live in private storage, served only through short-lived signed URLs to authenticated members of your business.",
  },
  {
    icon: Unplug,
    title: "Your data is never hostage",
    body: "Export everything, any time: a CSV of all records and bulk PDF downloads of every signed waiver — in the app, with no volume caps and no “storage plan” fee. Viewing and exporting your existing records is never gated on your subscription. Cancel, and your signed waivers stay viewable and downloadable.",
  },
];

const CAPTURED = [
  "The signer's full legal name",
  "Email address (when collected)",
  "Date of birth (where age matters)",
  "The drawn or typed signature image",
  "Guardian name, relationship, and signature (for minors)",
  "Any custom fields you configured (medical conditions, emergency contact, …)",
  "The exact consent statement they agreed to, stored verbatim",
  "The exact waiver version text they signed",
  "IP address and browser / device (user agent)",
  "A UTC timestamp and the signing channel (link, QR, or kiosk)",
  "A SHA-256 integrity hash of the final PDF",
];

const SUBPROCESSORS = [
  {
    name: "Supabase",
    purpose: "Database, authentication, and encrypted file storage",
  },
  { name: "Vercel", purpose: "Application hosting and content delivery" },
  {
    name: "Anthropic (Claude)",
    purpose: "AI conversion of an uploaded waiver PDF into a digital form",
  },
  {
    name: "Resend",
    purpose: "Transactional email — signed copies and notifications",
  },
  {
    name: "Creem",
    purpose: "Subscription billing — we never see or store card numbers",
  },
  {
    name: "Cloudflare Turnstile",
    purpose: "Bot protection on public signing pages",
  },
];

const LIFECYCLE = [
  {
    when: "While your account is active",
    what: "Every signed waiver is retained — immutable, searchable, and exportable at any time.",
  },
  {
    when: "If you cancel",
    what: "Your records stay viewable and downloadable. A lapsed subscription only pauses new signatures; it never locks your existing legal documents.",
  },
  {
    when: "On request or account closure",
    what: "We delete your organization's data when you ask us to.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        {/* Hero */}
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Security &amp; evidence
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Built like a system of record, because it is one
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A signed waiver only matters on the worst day of your year. Here is
          exactly how {APP.name} makes sure the record holds up on it — and why
          you&apos;re never locked in.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {TRUST_CHIPS.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              <BadgeCheck className="size-3.5 text-success" />
              {chip}
            </span>
          ))}
        </div>

        {/* Core pillars */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">How the evidence holds up</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {PILLARS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-600 dark:text-brand-300">
                    <p.icon className="size-4.5" />
                  </span>
                  <h3 className="font-semibold leading-tight">{p.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Data captured */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-600 dark:text-brand-300">
              <FileCheck2 className="size-4.5" />
            </span>
            <h2 className="text-xl font-semibold">
              What every signed waiver captures
            </h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Far more than a paper form — a purpose-built evidence bundle attached
            to each signature:
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {CAPTURED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground/90">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Data lifecycle & ownership */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-600 dark:text-brand-300">
              <Unplug className="size-4.5" />
            </span>
            <h2 className="text-xl font-semibold">Your records, your custody</h2>
          </div>
          <div className="mt-4 space-y-3">
            {LIFECYCLE.map((row) => (
              <div
                key={row.when}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="text-sm font-semibold">{row.when}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {row.what}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Subprocessors */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-600 dark:text-brand-300">
              <Server className="size-4.5" />
            </span>
            <h2 className="text-xl font-semibold">Where your data lives</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {APP.name} runs on infrastructure from providers that maintain SOC 2
            Type II attestations (Supabase and Vercel). These are the
            subprocessors that handle data on our behalf:
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Provider</th>
                  <th className="px-4 py-2.5 font-medium">What it does</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((s, i) => (
                  <tr
                    key={s.name}
                    className={i < SUBPROCESSORS.length - 1 ? "border-b border-border/60" : ""}
                  >
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Legal recognition */}
        <section className="mt-12">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-brand-600 dark:text-brand-300">
              <Database className="size-4.5" />
            </span>
            <h2 className="text-xl font-semibold">Legal recognition</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">
            Electronic signatures collected through {APP.name} are recognized in
            the United States under the federal ESIGN Act and UETA. Every signer
            affirmatively consents before signing, and the exact consent text is
            stored with the record. For the full picture of what makes a digital
            waiver enforceable, see{" "}
            <Link
              href="/blog/are-digital-waivers-legally-binding"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
            >
              are digital waivers legally binding?
            </Link>
          </p>
        </section>

        {/* Questionnaire CTA */}
        <section className="mt-12 rounded-2xl border border-brand-500/40 bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Got a security questionnaire?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions about our data handling, or a specific compliance
            requirement for your vendor review? We answer these personally.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button render={<a href={`mailto:${APP.supportEmail}`} />}>
              Email {APP.supportEmail}
            </Button>
            <Button variant="outline" render={<Link href="/signup" />}>
              Start a free trial
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground/70">
            This page is not legal advice; have a lawyer review your waiver text.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
