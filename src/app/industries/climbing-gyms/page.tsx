import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, FileSearch, FileUp, Mountain, QrCode, Users } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { APP } from "@/lib/config";

const title = "Climbing Gym Waiver Software — Unlimited Waivers | FlatWaiver";
const description = `Digital waiver software for climbing gyms. Use your existing waiver, collect guardian signatures, and find signed PDFs. Unlimited waivers for $${APP.priceMonthlyUsd}/month.`;
const url = `${APP.siteUrl}/industries/climbing-gyms`;
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: url },
  openGraph: { title, description, url, type: "website", siteName: APP.name,
    images: [{ url: `${APP.siteUrl}/opengraph-image`, alt: "FlatWaiver — digital waivers" }] },
  twitter: { card: "summary_large_image", title, description, images: [`${APP.siteUrl}/opengraph-image`] },
};

const faqs = [
  ["Can climbers sign before arriving?", "Yes. Add your published waiver link to your website or the booking and group-visit messages you already send. Climbers can read and sign on their own device before they reach reception."],
  ["Can parents sign for minors?", "Yes. Enable minors on the waiver to collect the young climber’s details, plus the parent or guardian’s name, relationship and signature. Your gym decides the appropriate wording and guardian requirements."],
  ["Can we use QR codes at the front desk?", "Yes. Print the QR code for your published waiver so visitors can open it on their phones. You can also open kiosk mode on a reception tablet for visitors who need a device."],
  ["Can we use our existing climbing waiver?", "Yes. Upload your existing PDF to create a draft. Review the converted wording and fields against the original, correct any issues, then publish. You can also start with your own text in the editor."],
  ["Can staff find an old signed waiver?", "Yes. Search signed records by name or email and filter by date or waiver. Open the record to download its stored signed PDF. Later edits to your template do not replace the version attached to an earlier signature."],
  ["Is FlatWaiver suitable for busy climbing gyms?", "FlatWaiver supports signing links, QR codes and kiosk mode, with unlimited signed waivers. Each participant completes their own signing flow; share the link ahead of group visits to spread out the paperwork."],
  ["How much does climbing gym waiver software cost?", `FlatWaiver is $${APP.priceMonthlyUsd}/month for unlimited signed waivers, waiver templates and storage. Start with a ${APP.trialDays}-day free trial, with no credit card required.`],
];
const heading = "text-2xl font-bold tracking-tight sm:text-3xl";
const copy = "mt-4 text-base leading-7 text-muted-foreground";
const section = "border-t border-border py-12 sm:py-16";
function TrialButton() {
  return <Button size="lg" render={<Link href="/signup" />}>Start free {APP.trialDays}-day trial <ArrowRight className="size-4" aria-hidden="true" /></Button>;
}

export default function ClimbingGymsPage() {
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: APP.siteUrl },
      { "@type": "ListItem", position: 2, name: "Climbing gyms", item: url },
    ],
  };
  return <>
    <MarketingHeader />
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      <section className="py-10 sm:py-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground"><Link href="/" className="hover:underline">Home</Link> / <span aria-current="page">Climbing gyms</span></nav>
        <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Mountain className="size-5" aria-hidden="true" /> For climbing gyms &amp; bouldering facilities</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Digital Waiver Software for Climbing Gyms</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Get the paperwork done before the first climb. Let visitors sign ahead, give walk-ins a QR code, and keep signed records within reach of your front desk.</p>
            <p className="mt-5 text-lg font-semibold">Unlimited waivers for ${APP.priceMonthlyUsd}/month.</p>
            <div className="mt-7 flex flex-wrap gap-3"><TrialButton /><Button size="lg" variant="outline" render={<Link href="#how-it-works" />}>See the workflow</Button></div>
            <p className="mt-3 text-sm text-muted-foreground">No credit card required. Start with the waiver you already use.</p>
          </div>
          <aside aria-label="Example front-desk workflow" className="rounded-3xl border border-primary/15 bg-primary/5 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">A smoother arrival</p>
            <h2 className="mt-3 text-xl font-semibold">One waiver. Three ways to sign.</h2>
            <ol className="mt-6 space-y-5">
              {[
                ["Before the visit", "Send the online climbing waiver link with your arrival instructions."],
                ["At reception", "Climbers scan your QR code and sign on their phones."],
                ["On your tablet", "Offer kiosk mode when a visitor needs a device."],
              ].map(([label, text], i) => <li key={label} className="flex gap-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold text-primary">{i + 1}</span><div><h3 className="font-semibold">{label}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div></li>)}
            </ol>
            <div className="mt-6 flex gap-3 border-t border-primary/15 pt-5 text-sm"><FileSearch className="size-5 shrink-0 text-primary" aria-hidden="true" /><p>Staff retrieve the signed record when the climber arrives.</p></div>
          </aside>
        </div>
      </section>

      <section className={section}>
        <div className="grid gap-6 md:grid-cols-2"><h2 className={heading}>A group arrives. Your front desk still has a queue.</h2><div>
          <p className="leading-7 text-muted-foreground">First-time climbers need arrival instructions, day-pass visitors need to get signed in, and a parent may need to complete a youth waiver. Passing around a clipboard puts every step in the same queue.</p>
          <p className={copy}>Move your climbing gym waiver form online so paperwork can happen before reception. For recurring members, staff can search for the existing signed record and follow your gym’s policy on when a new waiver is needed.</p>
        </div></div>
      </section>

      <section id="how-it-works" className={`${section} scroll-mt-24`}>
        <h2 className={heading}>From your waiver to a signed record</h2>
        <ol className="mt-7 grid gap-5 md:grid-cols-3">
          {[
            { Icon: FileUp, title: "Prepare and review", text: "Upload your existing waiver PDF or add your own text. Review the draft and signing fields, then publish." },
            { Icon: QrCode, title: "Share and collect", text: "Give climbers the signing link, a reception QR code or a kiosk tablet. Each visitor reads and signs their waiver." },
            { Icon: FileSearch, title: "Find it later", text: "Search your signed records and download the stored PDF when staff need a copy." },
          ].map(({ Icon, title: stepTitle, text }, i) => <li key={stepTitle} className="rounded-2xl border bg-card p-6"><Icon className="size-6 text-primary" aria-hidden="true" /><h3 className="mt-5 font-semibold">{i + 1}. {stepTitle}</h3><p className={copy}>{text}</p></li>)}
        </ol>
      </section>

      <section className={section}>
        <div className="grid gap-10 md:grid-cols-2">
          <article><p className="text-sm font-semibold text-primary">Before arrival</p><h2 className={`mt-3 ${heading}`}>Give climbers time to read</h2><p className={copy}>Include a waiver link in the messages you send for introductory sessions, day passes or group visits. Customers can complete the rock climbing waiver at home instead of reading it while other visitors wait behind them.</p><p className={copy}>You place the link in your existing communications. FlatWaiver handles the signing and record storage; your booking process stays with the tools you already use.</p></article>
          <article><p className="text-sm font-semibold text-primary">At reception</p><h2 className={`mt-3 ${heading}`}>A phone or tablet replaces the clipboard</h2><p className={copy}>Print your waiver’s QR code where visitors check in. Walk-ins scan it and sign on their own phones. Keep a tablet in kiosk mode for visitors without a suitable device; after a completed signature, it resets for the next participant.</p><p className={copy}>For a group arrival, share the link in advance and use QR signing for anyone who still needs to complete the form.</p></article>
        </div>
      </section>

      <section className={section}>
        <div className="max-w-3xl"><Users className="size-7 text-primary" aria-hidden="true" /><h2 className={`mt-4 ${heading}`}>Make room for young climbers and their guardians</h2>
          <p className={copy}>Enable the minor option for youth sessions, family visits or junior programs. The form collects the young participant’s details alongside a parent or guardian’s full name, relationship and signature.</p>
          <p className={copy}>Send the link to parents before the visit so the responsible adult can complete the guardian section. Use waiver wording and a guardian process appropriate for your gym and jurisdiction.</p>
        </div>
      </section>

      <section className={section}>
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]"><div><h2 className={heading}>Bring the climbing waiver you already use</h2><p className={copy}>Start with your existing climbing gym liability waiver, including wording you have had reviewed by your legal adviser or insurer. Upload the PDF and FlatWaiver converts it into an editable draft.</p><p className={copy}>Compare the draft against the original file, correct conversion issues, check the fields and consent text, then publish. You control the document that visitors sign.</p></div><aside className="rounded-2xl border bg-muted/40 p-6"><h3 className="font-semibold">Review before you publish</h3><p className={copy}>Conversion helps prepare the form; it does not provide legal review or guarantee enforceability. Keep the original document handy while checking the draft.</p><Link href="/blog/online-waivers" className="mt-5 inline-block font-medium text-primary underline underline-offset-4">Read the online waiver guide</Link></aside></div>
      </section>

      <section className={section}>
        <h2 className={heading}>Keep the record, even when your waiver changes</h2>
        <p className={`${copy} max-w-3xl`}>Search by participant name or email, then filter by date or waiver. Download the stored signed PDF rather than reconstructing a document from today’s template. Each signature is tied to the published version that the participant signed, with signing details and timestamps.</p>
        <p className={`${copy} max-w-3xl`}>That gives staff a practical way to retrieve an older climbing gym digital waiver after the original visit. Updating your wording for a new season does not overwrite earlier signed records.</p>
        <Link href="/security" className="mt-5 inline-block font-medium text-primary underline underline-offset-4">How FlatWaiver stores signed records</Link>
      </section>

      <section className="my-6 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-10">
        <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]"><div><p className="text-sm font-semibold text-primary">Room for your busiest months</p><h2 className={`mt-3 ${heading}`}>300 waivers or 3,000. The same monthly price.</h2><p className={copy}>Day passes, new members and group visits do not need separate signature allowances. FlatWaiver is ${APP.priceMonthlyUsd}/month for unlimited signed waivers, templates and storage.</p><ul className="mt-5 space-y-2">{["Unlimited signed waivers", "Unlimited waiver templates", "Unlimited storage"].map(item => <li key={item} className="flex gap-2 text-sm"><Check className="size-5 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}</ul></div><div><p className="mb-5 text-4xl font-bold">${APP.priceMonthlyUsd}<span className="text-base font-normal text-muted-foreground"> / month</span></p><TrialButton /><p className="mt-3 text-sm text-muted-foreground">{APP.trialDays}-day free trial. No credit card required.</p><Link href="/#pricing" className="mt-4 inline-block text-sm underline underline-offset-4">View pricing details</Link></div></div>
      </section>

      <section className={section}>
        <h2 className={heading}>Climbing gym waiver questions</h2>
        <div className="mt-7 divide-y rounded-2xl border px-5 sm:px-8">{faqs.map(([question, answer]) => <details key={question} className="py-5"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">{question}</summary><p className="mt-3 max-w-3xl leading-7 text-muted-foreground">{answer}</p></details>)}</div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm"><Link href="/blog/waiver-software-for-climbing-gyms" className="underline underline-offset-4">Climbing gym setup and buying guide</Link><Link href="/industries/martial-arts" className="underline underline-offset-4">Waivers for martial arts schools</Link><Link href="/industries" className="underline underline-offset-4">Explore all industries</Link></div>
      </section>
    </main>
    <MarketingFooter />
  </>;
}
