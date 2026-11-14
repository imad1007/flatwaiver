import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, FileCheck2, Layers, Mountain, PenLine, QrCode, Smartphone, Bike, HandFist } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP } from "@/lib/config";

const industries = [
  { title: "Climbing gyms", description: "Waivers before every climb.", image: "climbing", alt: "Climber on an indoor bouldering wall", href: "/industries/climbing-gyms", icon: Mountain },
  { title: "Trampoline parks", description: "Faster family check-in.", image: "trampoline", alt: "Guests enjoying an indoor trampoline park", href: "/industries/trampoline-parks", icon: Layers },
  { title: "Martial arts", description: "Simple member onboarding.", image: "martial-arts", alt: "Two martial artists practicing Brazilian jiu-jitsu", href: "/industries/martial-arts", icon: HandFist },
  { title: "Adventure & rentals", description: "Sign before the activity.", image: "adventure", alt: "ATV riders on a mountain trail at sunset", href: "/industries", icon: Bike },
];

const values = [
  { value: `$${APP.priceMonthlyUsd}`, label: "per month. One flat price." },
  { value: "Unlimited", label: "waivers, templates & storage" },
  { value: "Under 5 min", label: "PDF to live signing link" },
  { value: "14 days", label: "free trial, no card required" },
];

const benefits = [
  { icon: QrCode, title: "QR code or signing link", text: "Share waivers before arrival or at the front desk." },
  { icon: Smartphone, title: "Made for mobile signing", text: "Guests read and sign right in their phone’s browser." },
  { icon: FileCheck2, title: "Signed records, organized automatically", text: "Search completed waivers and download PDFs from your dashboard." },
];

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background";

export function IndustriesSection() {
  return (
    <section aria-labelledby="industries-heading" className="border-y border-border bg-muted/20 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Built for your business</p>
          <h2 id="industries-heading" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">One waiver platform. Every adventure.</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">From gyms to adventure parks, give every guest a faster way to sign.</p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {industries.map((industry) => (
            <Link key={industry.title} href={industry.href} className={`group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/60 ${focus}`}>
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image src={`/images/landing/${industry.image}.webp`} alt={industry.alt} fill sizes="(min-width: 1152px) 264px, (min-width: 1024px) 23vw, (min-width: 640px) 46vw, 92vw" className="object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-[1.03]" />
              </div>
              <div className="flex items-center gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><industry.icon className="size-5" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-tight">{industry.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{industry.description}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
              </div>
            </Link>
          ))}
        </div>
        <nav aria-label="More waiver industries and guides" className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <Link href="/industries/fitness-studios" className={`inline-flex min-h-11 items-center rounded-sm hover:text-primary ${focus}`}>Gyms &amp; fitness</Link>
          <Link href="/blog/gym-waiver-software" className={`inline-flex min-h-11 items-center rounded-sm hover:text-primary ${focus}`}>Waiver software for gyms</Link>
          <Link href="/blog/waiver-software-for-climbing-gyms" className={`inline-flex min-h-11 items-center rounded-sm hover:text-primary ${focus}`}>Climbing gym waiver software</Link>
          <Link href="/industries" className={`inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-primary sm:ml-auto ${focus}`}>Explore all industries <ArrowRight className="size-4" aria-hidden /></Link>
        </nav>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">For tours &amp; activities, rentals, gun ranges, and escape rooms, too.</p>
        <dl className="mt-8 grid grid-cols-2 border-t border-border pt-2 lg:grid-cols-4">
          {values.map((stat, index) => (
            <div key={stat.value} className={`flex flex-col py-6 pr-4 ${index % 2 ? "border-l border-border pl-5" : "lg:pl-6"} ${index > 1 ? "border-t border-border lg:border-t-0 lg:border-l" : ""} ${index === 0 ? "lg:pl-0" : ""}`}>
              <dt className="text-sm leading-relaxed text-muted-foreground">{stat.label}</dt>
              <dd className="-order-1 mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function MobileSigningSection() {
  return (
    <section aria-labelledby="mobile-signing-heading" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
      <div className="grid items-center gap-x-14 gap-y-7 lg:grid-cols-2">
        <div className="contents lg:block">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Sign anywhere, in seconds</p>
          <h2 id="mobile-signing-heading" className="mt-3 max-w-lg text-3xl font-extrabold tracking-tight sm:text-4xl">Less paperwork.<br />More happy customers.</h2>
          <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">Your guests scan, sign, and get started. No app downloads or signer accounts required.</p>
          <ul className="mt-7 space-y-5">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card"><benefit.icon className="size-4 text-primary" aria-hidden /></span>
                <div><h3 className="text-sm font-semibold">{benefit.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{benefit.text}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="row-start-3 flex flex-wrap items-center gap-x-6 gap-y-4 lg:mt-7">
          <Button size="lg" render={<Link href="/signup" />} className="min-h-12 px-5">Start your free trial <ArrowRight className="size-4" aria-hidden /></Button>
          <Link href="/blog/gym-waiver-software" className={`inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-primary underline underline-offset-4 ${focus}`}>Explore gym waiver software</Link>
          <p className="w-full text-xs text-muted-foreground">14 days free. No credit card required.</p>
        </div>
        </div>
        <SigningPreview />
      </div>
    </section>
  );
}

/** Static, synthetic example based on SigningForm and SignatureCanvas. No live form controls. */
function SigningPreview() {
  return (
    <figure className="row-start-2 min-w-0 rounded-3xl border border-border bg-card px-4 pb-5 pt-5 sm:px-8 lg:col-start-2 lg:row-start-1">
      <div className="mb-5 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">The guest experience</span><span className="rounded-full border border-border bg-card px-2.5 py-1">Sample preview</span></div>
      <div aria-hidden="true" className="mx-auto max-w-[284px] rounded-[2.5rem] border border-border bg-background p-2 shadow-pop">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-card">
          <div className="flex items-center justify-center gap-1.5 border-b border-border bg-muted/40 py-3 text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-success" />{APP.name} · Secure signing</div>
          <div className="space-y-3 p-4 text-[11px]">
            <div><p className="text-[10px] text-muted-foreground">Summit Climbing · Sample business</p><p className="mt-1.5 text-lg font-bold tracking-tight">Climbing waiver</p><p className="mt-1 text-muted-foreground">Read carefully before signing.</p></div>
            <div className="rounded-xl border border-border bg-muted/20 p-3"><p className="font-semibold">Assumption of risk</p><p className="mt-2 leading-relaxed text-muted-foreground">I understand that climbing involves risks and acknowledge my responsibility to follow the facility’s safety instructions.</p><p className="mt-2 text-[9px] text-muted-foreground">Illustrative excerpt, not a legal template.</p></div>
            <div className="flex gap-2 rounded-xl border border-border p-3"><span className="flex size-4 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground"><Check className="size-3" /></span><span>I agree to sign electronically.</span></div>
            <div><p className="mb-1.5 font-medium">Full legal name</p><div className="rounded-md border border-input px-3 py-2">Alex Morgan</div></div>
            <div><p className="font-medium">Your signature</p><div className="my-2 flex gap-3 text-[10px]"><span className="text-muted-foreground">○ Draw</span><span className="font-semibold text-primary">● Type</span></div><div className="rounded-md border border-input px-3 py-3 font-serif text-xl italic">Alex Morgan</div></div>
            <div className="rounded-lg bg-primary py-3 text-center text-sm font-semibold text-primary-foreground">Sign waiver</div>
            <p className="text-center text-[9px] text-muted-foreground">Powered by {APP.name}</p>
          </div>
        </div>
      </div>
      <ol aria-label="Signing journey" className="mx-auto mt-6 flex max-w-xs items-center justify-between gap-2 text-xs font-medium">
        {[{ icon: QrCode, label: "Scan" }, { icon: PenLine, label: "Sign" }, { icon: Check, label: "Done" }].map((step, index) => (
          <li key={step.label} className="flex items-center gap-2"><step.icon className="size-3.5 text-primary" aria-hidden /><span>{step.label}</span>{index < 2 && <ArrowRight className="ml-2 size-3 text-muted-foreground sm:ml-5" aria-hidden />}</li>
        ))}
      </ol>
      <figcaption className="mx-auto mt-4 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">Example of the public signing form with synthetic details. Completed waivers appear in your dashboard.</figcaption>
    </figure>
  );
}
