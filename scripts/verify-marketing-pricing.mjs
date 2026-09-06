import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  COMPARABLE_COMPETITORS,
  COMPETITOR_PRICING_VERIFIED_ON,
  PUBLISHED_COMPETITOR_PRICING,
  publishedPlanCost,
} from "../src/lib/competitor-pricing.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [homepage, calculator] = await Promise.all([
  source("src/app/page.tsx"),
  source("src/components/marketing/savings-calculator.tsx"),
]);

assert.equal(COMPETITOR_PRICING_VERIFIED_ON, "September 5, 2026");
assert.equal(PUBLISHED_COMPETITOR_PRICING.length, 3);
assert.equal(COMPARABLE_COMPETITORS.length, 2);

for (const competitor of PUBLISHED_COMPETITOR_PRICING) {
  assert.match(competitor.sourceUrl, /^https:\/\//);
  assert.ok(competitor.priceSummary.length > 0);
  assert.ok(competitor.thousandSummary.length > 0);
}

const smartwaiver = COMPARABLE_COMPETITORS.find(
  (competitor) => competitor.name === "Smartwaiver",
);
const waiverFile = COMPARABLE_COMPETITORS.find(
  (competitor) => competitor.name === "WaiverFile",
);
assert.ok(smartwaiver);
assert.ok(waiverFile);

assert.equal(publishedPlanCost(smartwaiver.plans, 100), 19);
assert.equal(publishedPlanCost(smartwaiver.plans, 101), 55);
assert.equal(publishedPlanCost(smartwaiver.plans, 1_000), 155);
assert.equal(publishedPlanCost(waiverFile.plans, 150), 19);
assert.equal(publishedPlanCost(waiverFile.plans, 151), 49);
assert.equal(publishedPlanCost(waiverFile.plans, 701), 149);
assert.equal(publishedPlanCost(waiverFile.plans, 1_000), 149);
assert.equal(publishedPlanCost(waiverFile.plans, 4_001), null);

assert.match(homepage, /PUBLISHED_COMPETITOR_PRICING\.map/);
assert.match(homepage, /href=\{competitor\.sourceUrl\}/);
assert.match(homepage, /Plans and features differ/);
assert.match(calculator, /publishedPlanCost\(competitor\.plans, volume\)/);
assert.match(calculator, /no\s+interpolation/i);
assert.doesNotMatch(calculator, /slope|atThousand|entry \+/);

console.log(
  "marketing pricing contracts passed (shared sources, discrete tiers, disclosures)",
);
