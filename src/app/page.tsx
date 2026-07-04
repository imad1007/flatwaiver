import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";
import { APP } from "@/lib/config";

const comparisonRows = [
  { name: "Smartwaiver", price: "$19–$155 by volume", thousand: "$155/mo", us: false },
  { name: "WaiverForever", price: "$19.99–$129 by volume", thousand: "$129/mo", us: false },
  { name: "WaiverFile", price: "$15–$199 by volume", thousand: "~$104/mo", us: false },
  { name: APP.name, price: "$39 flat", thousand: "$39/mo", us: true },
];

const features = [
  {
    title: "Your waiver, digital in 5 minutes",
    body: "Upload your existing PDF. AI converts it into a signable form. Review, publish, done. No rebuilding from scratch.",
  },
  {
    title: "Sign anywhere",
    body: "Send a link, print a QR code, or run kiosk mode on a front-desk tablet. Works on any phone, no app.",
  },
  {
    title: "Court-ready records",
    body: "Every signature is stored with timestamp, IP, consent record, and a SHA-256 integrity hash, locked to the exact waiver version signed. Search and export anytime.",
  },
];

const faqs = [
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

export default function LandingPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Unlimited waivers. $39/month. Flat.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            Stop paying per signed waiver. Upload the PDF you already use — your
            digital waiver is live in 5 minutes.
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-lg bg-neutral-900 px-8 py-4 text-lg font-semibold text-white hover:bg-neutral-700"
            >
              Start free 14-day trial
            </Link>
            <p className="mt-3 text-sm text-neutral-500">No credit card required</p>
          </div>
        </section>

        {/* Comparison table */}
        <section className="mx-auto max-w-3xl px-6 py-12">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm sm:text-base">
              <thead>
                <tr className="border-b border-neutral-300">
                  <th className="py-3 pr-4"></th>
                  <th className="py-3 pr-4 font-semibold">Monthly price</th>
                  <th className="py-3 font-semibold">1,000 waivers/month costs</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.name}
                    className={`border-b border-neutral-200 ${row.us ? "bg-neutral-50 font-bold" : ""}`}
                  >
                    <td className="py-3 pr-4">{row.name}</td>
                    <td className="py-3 pr-4">{row.price}</td>
                    <td className="py-3">{row.thousand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Competitor prices from public pricing pages, July 2026.
          </p>
        </section>

        {/* Feature blocks */}
        <section className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-bold">{f.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">{f.body}</p>
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold">Frequently asked questions</h2>
          <dl className="mt-8 space-y-8">
            {faqs.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-2 text-neutral-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-neutral-200 bg-neutral-50 py-16 text-center">
          <h2 className="text-3xl font-bold">Unlimited waivers. $39/month. Flat.</h2>
          <div className="mt-8">
            <Link
              href="/signup"
              className="inline-block rounded-lg bg-neutral-900 px-8 py-4 text-lg font-semibold text-white hover:bg-neutral-700"
            >
              Start free 14-day trial
            </Link>
            <p className="mt-3 text-sm text-neutral-500">No credit card required</p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
