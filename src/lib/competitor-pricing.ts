export const COMPETITOR_PRICING_VERIFIED_ON = "September 5, 2026";

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
    priceSummary: "$19–$199 by monthly volume",
    thousandSummary: "$155/mo",
    plans: [
      { monthlyWaivers: 100, monthlyUsd: 19 },
      { monthlyWaivers: 300, monthlyUsd: 55 },
      { monthlyWaivers: 1_000, monthlyUsd: 155 },
      { monthlyWaivers: 2_500, monthlyUsd: 199 },
    ],
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
  return (
    plans.find((plan) => monthlyWaivers <= plan.monthlyWaivers)?.monthlyUsd ??
    null
  );
}
