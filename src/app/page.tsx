import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileDown,
  FileUp,
  Link2,
  Lock,
  Mail,
  MonitorSmartphone,
  QrCode,
  ScanLine,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { Reveal } from "@/components/marketing/reveal";
import { SavingsCalculator } from "@/components/marketing/savings-calculator";
import {
  ConvertMockup,
  EvidenceCard,
  PhoneMockup,
  QrChip,
} from "@/components/marketing/mockups";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { DemoSandbox } from "@/components/marketing/demo-sandbox";
import { Button } from "@/components/ui/button";
import { APP } from "@/lib/config";

// ─── Content ────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "Gyms & fitness",
  "Climbing",
  "Trampoline parks",
  "Martial arts",
  "Tours & activities",
  "Rentals",
  "Gun ranges",
  "Escape rooms",
];

const STATS = [
  { value: "$39", label: "per month. Flat, forever." },
  { value: "∞", label: "waivers, templates & storage" },
  { value: "< 5 min", label: "from PDF to live signing link" },
  { value: "14 days", label: "free trial, no card required" },
];

const COMPARISON = [
  { name: "Smartwaiver", price: "$19–$155 by volume", thousand: 155, display: "$155/mo" },
  { name: "WaiverForever", price: "$19.99–$129 by volume", thousand: 129, display: "$129/mo" },
  { name: "WaiverFile", price: "$15–$199 by volume", thousand: 104, display: "~$104/mo" },
  { name: APP.name, price: "$39 flat", thousand: 39, display: "$39/mo", us: true },
];

const BENTO = [
  {
    icon: MonitorSmartphone,
    title: "Kiosk mode",
    body: "Run a front-desk tablet that resets itself after every signature.",
  },
  {
    icon: QrCode,
    title: "QR codes",
    body: "Print one at the counter — customers scan and sign on their own phone.",
  },
  {
    icon: Lock,
    title: "Version locking",
    body: "Every signature is bound to the exact waiver text it was signed against, forever.",
  },
  {
    icon: Users,
    title: "Minor & guardian flow",
    body: "Under-18 participants automatically get guardian name, relationship, and signature.",
  },
  {
    icon: FileDown,
    title: "CSV export",
    body: "Your data is yours — export every record, any time, even after cancelling.",
  },
  {
    icon: Mail,
    title: "Email copies",
    body: "Signers get their PDF automatically; you get notified on every signature.",
  },
];

/** Drop real testimonials in here as they arrive — section hides while empty. */
const TESTIMONIALS: { quote: string; name: string; role: string }[] = [];

const FAQS = [
  {
    q: "Are digital waivers legally binding?",
    a: `In the US, electronic signatures are recognized under the federal ESIGN Act and UETA. ${APP.name} captures the consent, identity, and integrity evidence commonly used to support enforceability. We provide the tool, not legal advice — have a lawyer review your waiver text.`,
  },
  {
    q: "Really unlimited?",
    a: "Yes. Flat $39/month for unlimited signed waivers, templates, and storage. Fair-use applies only to abuse (e.g., automated spam).",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You can search, download, and export all signed waivers even after cancellation. We never hold your legal documents hostage.",
  },
  {
    q: "Can customers sign from their phone?",
    a: "Yes — the signing page is mobile-first. No app or account needed.",
  },
];

const PRICING_CHECKLIST = [
  "Unlimited signed waivers",
  "Unlimited waiver templates",
  "Unlimited storage — records kept forever",
  "AI PDF conversion",
  "Kiosk mode, QR codes & signing links",
  "Court-ready evidence on every signature",
  "Search & CSV export, never paywalled",
  "Email copies for signers & owners",
];

// ─── Structured data (rich results: org, product+price, FAQ) ────────────────

const SITE_URL = APP.siteUrl;

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: APP.name,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: APP.name,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: APP.name,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Digital waiver software with unlimited signed waivers, kiosk mode, QR codes, AI PDF conversion, and court-ready evidence — for one flat monthly price.",
      offers: {
        "@type": "Offer",
        price: String(APP.priceMonthlyUsd),
        priceCurrency: "USD",
        description: `Flat $${APP.priceMonthlyUsd}/month for unlimited signed waivers`,
      },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ],
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <MarketingHeader />
      <main className="flex-1 overflow-x-clip">
        <Hero />
        <Industries />
        <Stats />
        <HowItWorks />
        <Comparison />
        <Features />
        <HonestyStrip />
        <TryIt />
        <Bento />
        <WhyWeBuiltThis />
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="relative">
      {/* Gradient mesh backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-105 w-200 -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl dark:bg-brand-500/10" />
        <div className="absolute top-40 right-[-10%] h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute top-64 left-[-8%] h-64 w-64 rounded-full bg-brand-300/15 blur-3xl dark:bg-brand-700/15" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pt-24">
        {/* Copy */}
        <div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full border border-brand-300/60 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground transition-colors hover:border-brand-400 dark:border-brand-700"
          >
            <Sparkles className="size-3" />
            Never pay per waiver again
            <ArrowRight className="size-3" />
          </Link>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Unlimited waivers.
            <br />
            $39/month.{" "}
            <span className="relative whitespace-nowrap text-brand-600 dark:text-brand-300">
              Flat.
              <svg
                aria-hidden
                viewBox="0 0 120 12"
                className="absolute -bottom-1.5 left-0 w-full text-brand-400/70"
                preserveAspectRatio="none"
              >
                <path
                  d="M3 9c30-6 80-7 114-3"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Stop paying per signed waiver. Upload the PDF you already use — your
            digital waiver is live in 5 minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" className="h-12 px-6 text-base shadow-pop" render={<Link href="/signup" />}>
              Start free 14-day trial
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base"
              render={<a href="#how-it-works" />}
            >
              See how it works
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground/80">No credit card required</p>

          {/* Trust bar */}
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-success" />
              Court-ready records
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-3.5 text-success" />
              ESIGN &amp; UETA recognized
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5 text-success" />
              SHA-256 integrity hashes
            </span>
          </div>
        </div>

        {/* Product visual */}
        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <Reveal>
            <div className="relative">
              <HeroDemo className="rotate-1" />
              <EvidenceCard className="absolute -bottom-10 -left-4 -rotate-2 sm:-left-10" />
              <QrChip className="absolute -top-6 -right-2 rotate-3 sm:-right-6" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Industries() {
  return (
    <section className="border-y border-border bg-muted/40 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Built for high-volume waiver businesses
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {INDUSTRIES.map((label) => (
            <span
              key={label}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid gap-8 text-center sm:grid-cols-4">
        {STATS.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 80}>
            <div>
              <div className="text-4xl font-extrabold tracking-tight text-brand-600 dark:text-brand-300">
                {stat.value}
              </div>
              <div className="mt-1.5 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: FileUp,
      title: "Upload your PDF",
      body: "The waiver you already use — no rebuilding from scratch, no retyping.",
    },
    {
      icon: Sparkles,
      title: "AI converts it",
      body: "Every clause preserved character-for-character. You review, then publish.",
    },
    {
      icon: Share2,
      title: "Share & collect",
      body: "Send the link, print the QR, or run kiosk mode. Signatures roll in.",
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From filing cabinet to live in five minutes"
          sub="Three steps. No implementation project, no sales call, no onboarding fee."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 100}>
              <div className="relative h-full rounded-2xl border border-border bg-card p-6 shadow-card">
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <step.icon className="size-6 text-brand-600 dark:text-brand-300" />
                <h3 className="mt-3 text-lg font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  return (
    <section id="compare" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="The math"
          title="Everyone else charges by volume. We don't."
          sub="Drag the slider to your monthly volume and watch what everyone else charges:"
        />

        <div className="mt-12 grid items-end gap-10 lg:grid-cols-2">
          {/* Interactive price comparison */}
          <Reveal>
            <SavingsCalculator />
          </Reveal>

          {/* Table */}
          <Reveal delay={120}>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-5 py-3.5 font-medium"></th>
                    <th className="px-5 py-3.5 font-medium">Monthly price</th>
                    <th className="px-5 py-3.5 font-medium">1,000 waivers/month costs</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr
                      key={row.name}
                      className={
                        row.us
                          ? "bg-accent font-bold text-accent-foreground"
                          : "border-b border-border/60"
                      }
                    >
                      <td className="px-5 py-3.5">{row.name}</td>
                      <td className="px-5 py-3.5">{row.price}</td>
                      <td className="px-5 py-3.5">{row.display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-5 pb-4 pt-2 text-xs text-muted-foreground/70">
                Competitor prices from public pricing pages, July 2026.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="space-y-24 py-20">
      {/* 1 — AI import */}
      <FeatureRow
        eyebrow="AI PDF import"
        title="Your waiver, digital in 5 minutes"
        body="Upload your existing PDF. AI converts it into a signable form. Review, publish, done. No rebuilding from scratch."
        bullets={[
          "Legal wording preserved character-for-character",
          "Signer fields detected automatically",
          "You review every clause before anything goes live",
        ]}
        visual={<ConvertMockup className="justify-center" />}
      />

      {/* 2 — Sign anywhere */}
      <FeatureRow
        flip
        eyebrow="Sign anywhere"
        title="Send a link, print a QR, or run a kiosk"
        body="Send a link, print a QR code, or run kiosk mode on a front-desk tablet. Works on any phone, no app."
        bullets={[
          "Mobile-first signing page your customers finish in seconds",
          "Kiosk mode auto-resets for the next person in line",
          "No accounts, no downloads, no friction",
        ]}
        visual={
          <div className="flex items-center justify-center gap-6">
            <PhoneMockup />
            <QrChip className="hidden -rotate-3 sm:flex" />
          </div>
        }
      />

      {/* 3 — Court-ready records */}
      <FeatureRow
        eyebrow="Court-ready records"
        title="Evidence that holds up when it matters"
        body="Every signature is stored with timestamp, IP, consent record, and a SHA-256 integrity hash, locked to the exact waiver version signed. Search and export anytime."
        bullets={[
          "Append-only records — nothing can be silently edited",
          "The exact consent text shown is stored with every signature",
          "Tamper-evident PDF with a built-in evidence page",
        ]}
        visual={
          <div className="flex justify-center py-4">
            <EvidenceCard className="rotate-1 scale-125" />
          </div>
        }
      />
    </section>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  bullets,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
      <Reveal className={flip ? "lg:order-2" : undefined}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">{title}</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{body}</p>
          <ul className="mt-5 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal delay={120} className={flip ? "lg:order-1" : undefined}>
        <div className="rounded-2xl border border-border bg-muted/40 p-8 sm:p-10">{visual}</div>
      </Reveal>
    </div>
  );
}

function HonestyStrip() {
  const items = [
    {
      icon: FileUp,
      title: "Preserved, not paraphrased",
      body: "AI copies your legal wording character-for-character and warns you about anything it can't read — it never guesses.",
    },
    {
      icon: BadgeCheck,
      title: "Nothing goes live without you",
      body: "Every AI conversion is a draft until you've reviewed it and hit publish. You own the legal text; we make that easy to honor.",
    },
    {
      icon: Lock,
      title: "Append-only, forever",
      body: "Signed waivers can never be silently edited — not by you, not by us. That's enforced in the database, not just promised.",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-brand-950 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-1/4 h-56 w-56 rounded-full bg-brand-500/20 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
              Straight talk
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
              How we treat your legal text
            </h2>
            <p className="mt-3 text-base text-brand-100/70">
              It&apos;s a liability document, not a landing page. These three rules
              are non-negotiable in how the product is built:
            </p>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 100}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-6">
                <item.icon className="size-5 text-brand-300" />
                <h3 className="mt-3 font-bold text-white">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-brand-100/70">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function TryIt() {
  return (
    <section id="try-it" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Try it yourself"
          title="Feel what your customers feel"
          sub="Sign the demo waiver below — right here, no signup. It's exactly the flow your customers get on their phone."
        />
        <Reveal className="mt-10">
          <DemoSandbox />
        </Reveal>
      </div>
    </section>
  );
}

function Bento() {
  return (
    <section className="bg-muted/40 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Everything included"
          title="No add-ons. No feature gates. No surprises."
          sub="One plan with everything — because nickel-and-diming is the old way."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENTO.map((item, i) => (
            <Reveal key={item.title} delay={(i % 3) * 80}>
              <div className="group h-full rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow duration-200 hover:shadow-pop">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-brand-600 transition-transform duration-200 group-hover:scale-110 dark:text-brand-300">
                  <item.icon className="size-4.5" />
                </div>
                <h3 className="mt-3 font-bold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyWeBuiltThis() {
  return (
    <section className="py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        {/* Supporting photo — below the fold, lazy-loaded, fixed dimensions */}
        <Reveal>
          <figure className="relative">
            <div
              aria-hidden
              className="absolute -inset-3 -rotate-1 rounded-2xl border border-brand-200/60 dark:border-brand-800/60"
            />
            <Image
              src="https://images.pexels.com/photos/8117465/pexels-photo-8117465.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop"
              alt="Front-desk employees working through a stack of paper documents together"
              width={1200}
              height={800}
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="relative rounded-2xl object-cover shadow-pop"
            />
          </figure>
        </Reveal>

        <Reveal delay={120}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
              Why we built this
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
              The busier your front desk gets, the more you pay. That&apos;s
              backwards.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Every waiver platform prices the same way: the more customers you
              welcome, the bigger your bill. A packed Saturday shouldn&apos;t come
              with a software penalty — and a binder of paper waivers
              shouldn&apos;t be the alternative.
            </p>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              So we built the version we&apos;d want at our own front desk: the
              waiver you already use, digital in minutes, evidence-grade forever
              — for one flat price that never moves.
            </p>
            <Button className="mt-6" size="lg" render={<Link href="/signup" />}>
              Start free 14-day trial
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Loved by operators" title="What our customers say" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <blockquote className="text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold">{t.name}</span>
                <span className="text-muted-foreground"> · {t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="One plan. One price. Zero mental math."
          sub="No per-waiver fees, ever. Sign ten or ten thousand — the bill is identical."
        />

        <Reveal>
          <div className="relative mx-auto mt-12 max-w-md overflow-hidden rounded-3xl border-2 border-brand-500/50 bg-card p-8 shadow-pop">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-brand-500/10 blur-2xl"
            />
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
              Everything, unlimited
            </p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-6xl font-extrabold tracking-tight">
                ${APP.priceMonthlyUsd}
              </span>
              <span className="text-lg text-muted-foreground">/month</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Flat. No tiers, no volume bands, no overage fees.
            </p>

            <ul className="mt-6 space-y-2.5">
              {PRICING_CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>

            <Button
              size="lg"
              className="mt-8 h-12 w-full text-base shadow-pop"
              render={<Link href="/signup" />}
            >
              Start free 14-day trial
            </Button>
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              No credit card required · cancel anytime · your data stays exportable
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 bg-muted/40 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10 space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-xl border border-border bg-card px-5 shadow-card open:pb-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="text-xl font-light text-muted-foreground transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-brand-950 py-20 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-brand-400/15 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Unlimited waivers. $39/month. Flat.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100/80">
          Your first waiver can be live before your coffee gets cold.
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            className="h-13 bg-white px-8 text-base font-semibold text-brand-700 shadow-pop hover:bg-brand-50"
            render={<Link href="/signup" />}
          >
            Start free 14-day trial
            <ArrowRight className="size-4" />
          </Button>
          <p className="mt-3 text-sm text-brand-200/70">No credit card required</p>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-brand-200/60">
          <span className="inline-flex items-center gap-1.5">
            <ScanLine className="size-3.5" /> Live in under 5 minutes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Link2 className="size-3.5" /> Link, QR & kiosk included
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Court-ready records
          </span>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <Reveal>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
        {sub && <p className="mt-3 text-base text-muted-foreground">{sub}</p>}
      </div>
    </Reveal>
  );
}
