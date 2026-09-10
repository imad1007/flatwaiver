import type { Metadata } from "next";
import Link from "next/link";
import { Check, FileSearch, FileUp, QrCode } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { APP } from "@/lib/config";

const title = "Martial Arts Waiver Software — Unlimited Waivers | FlatWaiver";
const description = `Digital waiver software for martial arts schools, BJJ gyms, MMA, karate and taekwondo. Collect unlimited signed waivers for $${APP.priceMonthlyUsd}/month.`;
const url = `${APP.siteUrl}/industries/martial-arts`;
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: url },
  openGraph: { title, description, url, type: "website", siteName: APP.name },
  twitter: { card: "summary_large_image", title, description },
};

const faqs = [
  ["What is martial arts waiver software?", "It gives your school an online workflow for collecting signatures on liability waivers and finding those records later. FlatWaiver handles the waiver workflow, while your existing tools handle classes and memberships."],
  ["Can parents sign waivers for minor students?", "Yes. Enable minors on the waiver to collect the parent or guardian’s name, relationship and signature alongside the young participant’s details. Have your waiver and guardian process reviewed for your jurisdiction."],
  ["Can BJJ gyms use FlatWaiver?", "Yes. A Brazilian jiu-jitsu academy can share its waiver before a trial class or display a signing QR code at reception. Separate templates can cover different activities where your school requires them."],
  ["Can MMA and boxing gyms use FlatWaiver?", "Yes. MMA, boxing and kickboxing gyms can use the same link, QR and kiosk signing workflow with their own activity-specific waiver text."],
  ["Can students sign before arriving?", "Yes. Copy your published signing link into the messages you send students before their first class. You can also add the link to your website or booking confirmation yourself."],
  ["Can I put a waiver QR code at the front desk?", "Yes. Print your waiver’s QR code so visitors can scan it and sign on their phones. A reception tablet can also run kiosk mode."],
  ["Can I use the waiver I already have?", "Yes. Upload your existing PDF to create a draft. Review the converted text and fields against your original, correct anything needed, then publish the version students will sign."],
  ["Does FlatWaiver create my legal waiver?", "FlatWaiver converts your document into a signing workflow; it does not provide legal advice or guarantee that the wording is suitable for your school. Have qualified counsel review your waiver."],
  ["How much does martial arts waiver software cost?", `FlatWaiver costs $${APP.priceMonthlyUsd}/month, with unlimited signed waivers, unlimited waiver templates and unlimited storage. Start with a ${APP.trialDays}-day free trial; no credit card is required.`],
  ["Can I download signed waiver PDFs?", "Yes. Find a signed record and download its stored PDF. You can also export record data as CSV and export signed PDFs. Owner email notifications with signed PDF attachments are optional."],
];
const steps = [
  { icon: FileUp, title: "Upload your existing waiver", text: "Turn your PDF into a draft, check the text and fields, and publish when it is ready." },
  { icon: QrCode, title: "Share your link, QR or kiosk", text: "Send a link before arrival, print a QR code or prepare a tablet at reception." },
  { icon: FileSearch, title: "Search and retrieve signed records", text: "Look up a participant and open the stored signed PDF when you need it." },
];
function TrialButton() {
  return <Button size="lg" render={<Link href="/signup" />}>Start free {APP.trialDays}-day trial</Button>;
}
const sectionClass = "border-t border-border py-12 sm:py-16";
const headingClass = "text-2xl font-bold tracking-tight sm:text-3xl";
const copyClass = "mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground";

export default function MartialArtsPage() {
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: APP.siteUrl },
      { "@type": "ListItem", position: 2, name: "Martial Arts", item: url },
    ],
  };
  return <>
    <MarketingHeader />
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      <section className="py-12 sm:py-20">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground"><Link href="/" className="hover:underline">Home</Link> / <span aria-current="page">Martial arts</span></nav>
        <p className="text-sm font-semibold text-primary">Less paperwork. More time on the mat.</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">Martial Arts Waiver Software for Busy Schools &amp; Gyms</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">Collect digital waivers from trial students, members and parents before they step onto the mat. Share a link, display a QR code or use kiosk mode — unlimited signed waivers for ${APP.priceMonthlyUsd}/month.</p>
        <div className="mt-8 flex flex-wrap gap-3"><TrialButton /><Button size="lg" variant="outline" render={<Link href="#how-it-works" />}>See how it works</Button></div>
        <p className="mt-3 text-sm text-muted-foreground">No credit card required.</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>Get every student signed before class starts</h2>
        <p className={copyClass}>A walk-in trial student arrives while your next class is lining up. Give them a reception QR code instead of another clipboard. For introductory sessions booked ahead, send the waiver link with your welcome message so students can read and sign before arrival.</p>
        <p className={copyClass}>Your front desk can look up the signed record without sorting through paper forms. One signing workflow serves regular classes, seasonal programs and the extra visitors arriving for a seminar or competition.</p>
      </section>
      <section className={sectionClass}>
        <h2 className={headingClass}>Built for BJJ, MMA, karate, taekwondo and more</h2>
        <p className={copyClass}>From Brazilian jiu-jitsu academies and judo clubs to karate and taekwondo youth programs, use the waiver your school has prepared for its activities. MMA, boxing, kickboxing, Muay Thai and wrestling schools can keep different waiver templates for classes and events without buying another template allowance.</p>
      </section>
      <section className={sectionClass}>
        <h2 className={headingClass}>Parents can sign for young students</h2>
        <p className={copyClass}>Enable the minor option when preparing your waiver. The signing form collects the young participant’s details plus a parent or guardian’s full name, relationship and signature. Send the link to parents ahead of the first lesson, or let them complete it at reception.</p>
        <p className={copyClass}>Guardian requirements vary. Have your school’s waiver text and signing process reviewed for your jurisdiction; a captured signature is not a guarantee of enforceability.</p>
      </section>
      <section className={sectionClass}>
        <h2 className={headingClass}>From your existing waiver PDF to online signing</h2>
        <p className={copyClass}>Start with the liability waiver your school already uses. FlatWaiver converts the uploaded PDF into a draft with text and signing fields. Check the draft against your original and correct any conversion issues before publishing. The original upload is available for review.</p>
        <p className={copyClass}>You control the published wording. FlatWaiver supplies the digital workflow, not new legal language. Read our <Link href="/blog/online-waivers" className="underline underline-offset-4">guide to online waivers</Link> for the basics.</p>
      </section>
      <section className={sectionClass}>
        <h2 className={headingClass}>Share a link, display a QR code, or use kiosk mode</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Before arrival", "Add your signing link to your website, registration instructions or the booking confirmation you send. Students sign on their own device."],
            ["At the front desk", "Display a printed QR code where trial students check in. They scan, read and sign without waiting for a shared clipboard."],
            ["On a reception tablet", "Open kiosk mode for visitors who need a device. It resets after a completed signature, ready for the next participant."],
          ].map(([heading, text]) => <article key={heading} className="rounded-2xl border bg-card p-6"><h3 className="font-semibold">{heading}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{text}</p></article>)}
        </div>
        <div className="mt-6"><TrialButton /></div>
      </section>
      <section className={sectionClass}>
        <h2 className={headingClass}>Find the signed waiver when you actually need it</h2>
        <p className={copyClass}>Search by participant name or email, then narrow records by date or waiver. Open the signed record and download its stored PDF. Each signature is tied to the exact published template version used at signing, so a later template update does not replace the text in an earlier record.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            ["A record you can retrieve", "Signed PDFs include signing details and timestamps. Stored version information and content/PDF hashes support record integrity."],
            ["Copies for your workflow", "Export record data as CSV or download signed PDFs. Enable optional owner notifications if you want a signed PDF attachment emailed to you."],
          ].map(([heading, text]) => <article key={heading} className="rounded-2xl border bg-card p-6"><h3 className="font-semibold">{heading}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{text}</p></article>)}
        </div>
      </section>
      <section className={sectionClass}>
        <h2 className={headingClass}>Why martial arts schools choose flat-rate waiver software</h2>
        <p className={copyClass}>Plan for the busy months as well as the quiet ones. Whether you collect 40 signatures from new students, 250 during a seminar month or 500+ around seasonal promotions, FlatWaiver’s monthly price stays the same. These are example volumes, not customer counts.</p>
        <p className={copyClass}>Unlimited signed waivers means no signature-volume tier to select. If you are comparing options, see our <Link href="/blog/flatwaiver-vs-smartwaiver" className="underline underline-offset-4">FlatWaiver vs Smartwaiver comparison</Link> for dated pricing and feature differences.</p>
      </section>
      <section className={sectionClass}>
        <h2 className={headingClass}>Waiver software without another gym-management system</h2>
        <p className={copyClass}>Already happy with your school’s billing, membership, belt tracking, attendance, scheduling or CRM tools? Keep them. FlatWaiver is focused <Link href="/" className="underline underline-offset-4">digital waiver software</Link> for collecting and retrieving signed waivers, rather than a replacement for your management system.</p>
        <p className={copyClass}>Share the signing link through the tools you already use. No membership migration is needed to start collecting waivers. For a broader buying checklist, read our <Link href="/blog/gym-waiver-software" className="underline underline-offset-4">gym waiver software guide</Link>.</p>
      </section>
      <section id="how-it-works" className={`${sectionClass} scroll-mt-24`}>
        <h2 className={headingClass}>How FlatWaiver works</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">{steps.map((step, index) => <li key={step.title} className="rounded-2xl border bg-card p-6"><step.icon className="mb-4 size-6 text-primary" aria-hidden="true" /><h3 className="font-semibold">{index + 1}. {step.title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{step.text}</p></li>)}</ol>
      </section>
      <section className="my-8 rounded-3xl border border-primary/20 bg-primary/5 px-6 py-10 sm:p-12">
        <h2 className={headingClass}>${APP.priceMonthlyUsd}/month. Unlimited martial arts waivers.</h2>
        <ul className="my-6 space-y-3">{["Unlimited signed waivers", "Unlimited waiver templates", "Unlimited storage"].map(item => <li key={item} className="flex items-center gap-2"><Check className="size-5 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}</ul>
        <TrialButton /><p className="mt-3 text-sm text-muted-foreground">{APP.trialDays}-day free trial. No credit card required. <Link href="/#pricing" className="underline">View pricing details</Link>.</p>
      </section>
      <section className={sectionClass}>
        <h2 className={headingClass}>Frequently asked questions</h2>
        <div className="mt-6 divide-y rounded-2xl border px-5 sm:px-8">{faqs.map(([question, answer]) => <details key={question} className="py-5"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{answer}</p></details>)}</div>
      </section>
    </main>
    <MarketingFooter />
  </>;
}
