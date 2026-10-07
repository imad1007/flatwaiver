import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSearch, FileUp, QrCode } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { APP } from "@/lib/config";
import { industryDirectory, type Industry } from "@/lib/industries";

export function industryMetadata(industry: Industry): Metadata {
  const title = `${industry.seoTitle} | ${APP.name}`;
  const description = industry.description;
  const url = `${APP.siteUrl}/industries/${industry.slug}`;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", siteName: APP.name,
      images: [{ url: `${APP.siteUrl}/opengraph-image`, alt: `${APP.name} digital waivers` }] },
    twitter: { card: "summary_large_image", title, description, images: [`${APP.siteUrl}/opengraph-image`] },
  };
}

const section = "border-t border-border py-12 sm:py-16";
const heading = "text-2xl font-bold tracking-tight sm:text-3xl";
const copy = "mt-4 text-base leading-7 text-muted-foreground";

function TrialButton() {
  return <Button size="lg" render={<Link href="/signup" />}>Start free {APP.trialDays}-day trial <ArrowRight className="size-4" aria-hidden="true" /></Button>;
}

export function IndustryLanding({ industry }: { industry: Industry }) {
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: APP.siteUrl },
      { "@type": "ListItem", position: 2, name: "Industries", item: `${APP.siteUrl}/industries` },
      { "@type": "ListItem", position: 3, name: industry.label, item: `${APP.siteUrl}/industries/${industry.slug}` },
    ],
  };
  return <>
    <MarketingHeader />
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
      <section className="py-10 sm:py-16">
        <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap gap-2 text-sm text-muted-foreground"><Link href="/" className="hover:underline">Home</Link><span>/</span><Link href="/industries" className="hover:underline">Industries</Link><span>/</span><span aria-current="page">{industry.label}</span></nav>
        <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-sm font-semibold text-primary">{industry.audience}</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{industry.title}</h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">{industry.introduction}</p>
            <p className="mt-5 text-lg font-semibold">Unlimited waivers for ${APP.priceMonthlyUsd}/month.</p>
            <div className="mt-7 flex flex-wrap gap-3"><TrialButton /><Button size="lg" variant="outline" render={<Link href="#how-it-works" />}>See the workflow</Button></div>
            <p className="mt-3 text-sm text-muted-foreground">No credit card required. Use the waiver you already have.</p>
            <Link href="/#try-it" className="mt-5 inline-block text-sm font-medium text-primary underline underline-offset-4">Try the interactive signing demo before creating an account</Link>
          </div>
          <aside className="rounded-3xl border border-primary/15 bg-primary/5 p-6 sm:p-8" aria-label="Example arrival workflow">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">A practical arrival plan</p>
            <h2 className="mt-3 text-xl font-semibold">{industry.scenarioTitle}</h2>
            <ol className="mt-6 space-y-5">{industry.steps.map((step, index) => <li key={step.title} className="flex gap-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold text-primary">{index + 1}</span><div><h3 className="font-semibold">{step.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p></div></li>)}</ol>
          </aside>
        </div>
      </section>
      <nav aria-label="On this page" className="flex flex-wrap gap-x-6 gap-y-3 border-t py-5 text-sm font-medium text-muted-foreground">
        <Link href="#how-it-works" className="hover:underline">Signing workflow</Link>
        <Link href="#choose-software" className="hover:underline">Software fit</Link>
        <Link href="#trial-checklist" className="hover:underline">Trial checklist</Link>
        <Link href="#pricing" className="hover:underline">Pricing</Link>
        <Link href="#questions" className="hover:underline">FAQs</Link>
      </nav>
      <section className={section}><div className="grid gap-6 md:grid-cols-2"><h2 className={heading}>{industry.headline}</h2><p className="leading-7 text-muted-foreground">{industry.scenario}</p></div></section>
      <section id="how-it-works" className={`${section} scroll-mt-24`}>
        <h2 className={heading}>From your existing document to a signed record</h2>
        <ol className="mt-7 grid gap-5 md:grid-cols-3">{[
          { Icon: FileUp, title: "Prepare and review", text: "Upload your existing waiver PDF or enter your own text. Compare the converted draft against the original, correct any issues and check the signing fields before publishing." },
          { Icon: QrCode, title: "Share the published form", text: "Copy the signing link into your own messages, display its QR code or open kiosk mode on your tablet. Visitors read and sign online; signing requires an internet connection." },
          { Icon: FileSearch, title: "Retrieve the record", text: "Search signed records by name or email and filter by date or waiver. Open the record and download its stored signed PDF when your team needs a copy." },
        ].map(({ Icon, title, text }, index) => <li key={title} className="rounded-2xl border bg-card p-6"><Icon className="size-6 text-primary" aria-hidden="true" /><h3 className="mt-5 font-semibold">{index + 1}. {title}</h3><p className={copy}>{text}</p></li>)}</ol>
      </section>
      {industry.sections.map(item => <section className={section} key={item.title}><div className="grid gap-6 md:grid-cols-[1fr_1.2fr]"><h2 className={heading}>{item.title}</h2><div>{item.paragraphs.map(text => <p key={text} className="mb-4 leading-7 text-muted-foreground">{text}</p>)}</div></div></section>)}
      <section id="choose-software" className={`${section} scroll-mt-24`}>
        <h2 className={heading}>{industry.criteriaTitle}</h2>
        <div className="mt-7 grid gap-5 md:grid-cols-3">{industry.criteria.map(item => <article key={item.need} className="rounded-2xl border bg-card p-6"><h3 className="font-semibold">{item.need}</h3><p className={copy}>{item.detail}</p></article>)}</div>
        <Link href={industry.guide.href} className="mt-6 inline-block font-medium text-primary underline underline-offset-4">{industry.guide.label}</Link>
      </section>
      <section id="trial-checklist" className={`${section} scroll-mt-24`}>
        <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]"><div><p className="text-sm font-semibold text-primary">Use the free trial to check your actual process</p><h2 className={`mt-3 ${heading}`}>{industry.checklistTitle}</h2><p className={copy}>Start with your reviewed document and sample participants. Test the handoff your team will use before sharing the signing link with visitors.</p></div><ol className="space-y-5">{industry.checklist.map((text, index) => <li key={text} className="flex gap-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span><p className="leading-7 text-muted-foreground">{text}</p></li>)}</ol></div>
        <div className="mt-8"><TrialButton /><p className="mt-3 text-sm text-muted-foreground">{APP.trialDays} days to test your own waiver. No credit card required.</p></div>
      </section>
      <section className={section}>
        <div className="grid gap-8 md:grid-cols-2">
          <article><h2 className={heading}>Preserve what each visitor signed</h2><p className={copy}>Each signed waiver is tied to the exact published template version used at signing. Updating your wording creates a new version without replacing earlier agreements. Retrieve the stored signed PDF with its signing details and timestamps rather than reconstructing it from today’s template.</p><p className={copy}>Use name or email search and date or waiver filters for record retrieval. CSV record exports and signed PDF exports support your own administrative workflow.</p><Link href="/security" className="mt-5 inline-block font-medium text-primary underline underline-offset-4">Read about signed-record storage</Link></article>
          <aside className="rounded-2xl border bg-muted/40 p-6"><h2 className="text-xl font-semibold">Review the document and your process</h2><p className={copy}>PDF conversion helps prepare an editable draft. It does not provide legal advice, verify guardian authority or guarantee enforceability. Have qualified counsel review your wording and signing requirements for your activities and jurisdiction.</p><p className={copy}>Before sharing the link, compare the draft with your original document, check consent text and test the participant and guardian flows you intend to use.</p><Link href="/blog/online-waivers" className="mt-5 inline-block font-medium text-primary underline underline-offset-4">Read the online waiver guide</Link></aside>
        </div>
      </section>
      <section id="pricing" className="my-6 scroll-mt-24 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:p-10">
        <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]"><div><h2 className={heading}>One monthly price through busy and quiet periods</h2><p className={copy}>${APP.priceMonthlyUsd}/month includes unlimited signed waivers, waiver templates and storage. Prepare separate reviewed documents where your activities need them, without selecting a signature-volume allowance.</p><Link href="/#pricing" className="mt-5 inline-block underline underline-offset-4">View pricing details</Link></div><div><TrialButton /><p className="mt-3 text-sm text-muted-foreground">{APP.trialDays}-day free trial. No credit card required.</p></div></div>
      </section>
      <section id="questions" className={`${section} scroll-mt-24`}>
        <h2 className={heading}>{industry.label} waiver questions</h2>
        <div className="mt-7 divide-y rounded-2xl border px-5 sm:px-8">{industry.faqs.map(faq => <details key={faq.question} className="py-5"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">{faq.question}</summary><p className="mt-3 max-w-3xl leading-7 text-muted-foreground">{faq.answer}</p></details>)}</div>
        <nav aria-label="Related industries" className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm"><Link href="/industries" className="underline underline-offset-4">Explore all industries</Link>{industry.related.map(slug => <Link key={slug} href={`/industries/${slug}`} className="underline underline-offset-4">Waivers for {industryDirectory.find(item => item.slug === slug)?.label.toLowerCase()}</Link>)}</nav>
      </section>
    </main>
    <MarketingFooter />
  </>;
}
