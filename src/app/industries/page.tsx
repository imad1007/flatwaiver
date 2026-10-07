import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { APP } from "@/lib/config";
import { industryDirectory } from "@/lib/industries";

const title = `Digital Waiver Software by Industry | ${APP.name}`;
const description = "Explore digital waiver workflows for climbing gyms, fitness studios, family attractions and outdoor activity operators. Find practical signing and record-retrieval guidance.";
const url = `${APP.siteUrl}/industries`;
export const metadata: Metadata = {
  title, description, alternates: { canonical: url },
  openGraph: { title, description, url, type: "website", siteName: APP.name },
  twitter: { card: "summary_large_image", title, description },
};

export default function IndustriesPage() {
  return <><MarketingHeader /><main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground"><Link href="/" className="hover:underline">Home</Link> / <span aria-current="page">Industries</span></nav>
    <h1 className="mt-8 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">Digital waivers for the way your business welcomes people</h1>
    <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">A first lesson, a birthday party and a morning launch have different check-in needs. Explore practical ways to share your reviewed waiver, collect signatures and retrieve signed records for your activity.</p>
    <p className="mt-4 text-muted-foreground">Every workflow uses the same ${APP.priceMonthlyUsd}/month plan with unlimited signed waivers, templates and storage. Start a {APP.trialDays}-day free trial with no credit card required.</p>
    <div className="mt-10 grid gap-5 md:grid-cols-2">{industryDirectory.map(item => <article key={item.slug} className="rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold"><Link href={`/industries/${item.slug}`} className="hover:text-primary hover:underline">{item.label}</Link></h2><p className="mt-3 leading-7 text-muted-foreground">{item.description}</p><Link href={`/industries/${item.slug}`} className="mt-5 inline-flex items-center gap-2 font-medium text-primary">Explore {item.label.toLowerCase()} waivers <ArrowRight className="size-4" aria-hidden="true" /></Link></article>)}</div>
    <aside className="mt-12 rounded-2xl border bg-muted/40 p-6"><h2 className="text-xl font-semibold">Bring your own reviewed wording</h2><p className="mt-3 max-w-3xl leading-7 text-muted-foreground">FlatWaiver provides signing links, QR codes, kiosk mode and stored signed PDFs. Your team chooses the wording and consent process. Document conversion is not legal review or a guarantee of enforceability.</p><div className="mt-5 flex flex-wrap gap-6"><Link href="/signup" className="font-medium text-primary underline underline-offset-4">Start free trial</Link><Link href="/security" className="underline underline-offset-4">Signed-record storage</Link></div></aside>
  </main><MarketingFooter /></>;
}
