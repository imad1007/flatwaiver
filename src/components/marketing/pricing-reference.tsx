import { APP } from "@/lib/config";
import { COMPETITOR_PRICING_CHECKED_ON, PUBLISHED_COMPETITOR_PRICING, SMARTWAIVER_PRICING, SMARTWAIVER_ANNOUNCEMENT_URL } from "@/lib/competitor-pricing";

/** Shared server-rendered references: articles and the calculator use one dataset. */
export function PricingReference({ smartwaiverOnly = false }: { smartwaiverOnly?: boolean }) {
  return <div className="my-6">
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <caption className="bg-muted/40 p-4 text-left">USD monthly subscriptions, checked {COMPETITOR_PRICING_CHECKED_ON}. Annual plans, taxes, add-ons and feature differences are excluded.</caption>
        <thead className="border-b bg-muted/40"><tr><th scope="col" className="p-4">{smartwaiverOnly ? "Smartwaiver plan" : "Provider"}</th><th scope="col" className="p-4">{smartwaiverOnly ? "Included waivers / month" : "Pricing model"}</th><th scope="col" className="p-4">{smartwaiverOnly ? "Monthly USD" : "At 1,000 / month"}</th></tr></thead>
        <tbody>{smartwaiverOnly ? SMARTWAIVER_PRICING.current.plans.map(plan => <tr key={plan.name} className="border-b last:border-0"><th scope="row" className="p-4 font-medium">{plan.name}</th><td className="p-4">{plan.monthlyWaivers.toLocaleString("en-US")}</td><td className="p-4">${plan.monthlyUsd}</td></tr>) : <>
          <tr className="border-b"><th scope="row" className="p-4">{APP.name}</th><td className="p-4">${APP.priceMonthlyUsd}/month, unlimited waivers</td><td className="p-4">${APP.priceMonthlyUsd}/month</td></tr>
          {PUBLISHED_COMPETITOR_PRICING.map(vendor => <tr key={vendor.name} className="border-b last:border-0"><th scope="row" className="p-4 font-medium"><a className="text-primary underline underline-offset-4" href={vendor.sourceUrl}>{vendor.name}</a></th><td className="p-4">{vendor.priceSummary}</td><td className="p-4">{vendor.thousandSummary}</td></tr>)}
        </>}</tbody>
      </table>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Smartwaiver’s <a href={SMARTWAIVER_ANNOUNCEMENT_URL} className="underline">official update</a> is effective October 8, 2026 at the applicable renewal. Premier is $280/month; its allowance is not verified here, so it is excluded from volume calculations. Enterprise is custom. WaiverFile figures are standalone monthly waiver plans, excluding its transaction-priced booking service. Compare overages before choosing a plan.</p>
  </div>;
}
