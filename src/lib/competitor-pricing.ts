export const COMPETITOR_PRICING_CHECKED_ON = "September 10, 2026";
export const SMARTWAIVER_PRICING_NOTICE = "Smartwaiver announced new pricing effective October 8, 2026.";
export const SMARTWAIVER_ANNOUNCEMENT_URL = "https://support.smartwaiver.com/hc/en-us/articles/48619421464845-Smartwaiver-Subscription-Pricing-Update-Overview-FAQs";

// Only tiers with verified allowances participate in volume comparisons.
const verifiedSmartwaiverPlans = [
  { name: "Basic", monthlyWaivers: 100, monthlyUsd: 19 },
  { name: "Growth", monthlyWaivers: 200, monthlyUsd: 37 },
  { name: "Starter", monthlyWaivers: 300, monthlyUsd: 55 },
  { name: "Professional", monthlyWaivers: 600, monthlyUsd: 105 },
  { name: "Business", monthlyWaivers: 1_000, monthlyUsd: 155 },
  { name: "Premium", monthlyWaivers: 2_500, monthlyUsd: 199 },
] as const;
export const SMARTWAIVER_PRICING = {
  current: {
    checkedOn: "2026-09-10",
    announcedOn: null,
    effectiveFrom: null, // Original start date not verified; do not invent it.
    effectiveThrough: "2026-10-07",
    plans: verifiedSmartwaiverPlans,
    premierMonthlyUsd: 270,
  },
  announced: {
    checkedOn: "2026-09-10",
    announcedOn: "2026-09-08",
    effectiveFrom: "2026-10-08",
    plans: verifiedSmartwaiverPlans.map((plan, index) => ({
      ...plan, monthlyUsd: [22, 41, 60, 110, 160, 205][index],
    })),
    premierMonthlyUsd: 280,
  },
} as const;

export interface PublishedPlan {
  monthlyWaivers: number;
  monthlyUsd: number;
}

export interface PublishedCompetitorPricing {
  name: string;
  sourceUrl: string;
  priceSummary: string;
  thousandSummary: string;
  plans?: readonly PublishedPlan[];
}

export const PUBLISHED_COMPETITOR_PRICING = [
  {
    name: "Smartwaiver",
    sourceUrl: "https://www.smartwaiver.com/pricing",
    priceSummary: "$19-$199 verified volume tiers (through Oct 7)",
    thousandSummary: "$155/mo",
    plans: SMARTWAIVER_PRICING.current.plans,
  },
  {
    name: "WaiverForever",
    sourceUrl: "https://www.waiverforever.com/pricing",
    priceSummary: "$19–$129 base + usage",
    thousandSummary: "Variable usage fee",
  },
  {
    name: "WaiverFile",
    sourceUrl: "https://www.waiverfile.com/Pricing.aspx",
    priceSummary: "$19–$249 by monthly volume",
    thousandSummary: "$149/mo",
    plans: [
      { monthlyWaivers: 150, monthlyUsd: 19 },
      { monthlyWaivers: 400, monthlyUsd: 49 },
      { monthlyWaivers: 700, monthlyUsd: 89 },
      { monthlyWaivers: 1_300, monthlyUsd: 149 },
      { monthlyWaivers: 4_000, monthlyUsd: 249 },
    ],
  },
] as const satisfies readonly PublishedCompetitorPricing[];

export type ComparableCompetitor =
  (typeof PUBLISHED_COMPETITOR_PRICING)[number] & {
    plans: readonly PublishedPlan[];
  };

export const COMPARABLE_COMPETITORS = PUBLISHED_COMPETITOR_PRICING.filter(
  (competitor): competitor is ComparableCompetitor => "plans" in competitor,
);

/** Return the least expensive published plan that covers the requested volume. */
export function publishedPlanCost(
  plans: readonly PublishedPlan[],
  monthlyWaivers: number,
): number | null {
  if (!Number.isFinite(monthlyWaivers) || monthlyWaivers < 0) return null;
  const covering = plans.filter((plan) => monthlyWaivers <= plan.monthlyWaivers);
  return covering.length ? Math.min(...covering.map((plan) => plan.monthlyUsd)) : null;
}
