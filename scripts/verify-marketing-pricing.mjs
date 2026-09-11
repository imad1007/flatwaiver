import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  COMPARABLE_COMPETITORS,
  COMPETITOR_PRICING_CHECKED_ON,
  PUBLISHED_COMPETITOR_PRICING,
  publishedPlanCost,
  SMARTWAIVER_PRICING,
} from "../src/lib/competitor-pricing.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [homepage, calculator] = await Promise.all([
  source("src/app/page.tsx"),
  source("src/components/marketing/savings-calculator.tsx"),
]);

assert.equal(COMPETITOR_PRICING_CHECKED_ON, "September 10, 2026");
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
assert.equal(publishedPlanCost(smartwaiver.plans, 101), 37);
assert.equal(publishedPlanCost(smartwaiver.plans, 1_000), 155);
assert.equal(publishedPlanCost(waiverFile.plans, 150), 19);
assert.equal(publishedPlanCost(waiverFile.plans, 151), 49);
assert.equal(publishedPlanCost(waiverFile.plans, 701), 149);
assert.equal(publishedPlanCost(waiverFile.plans, 1_000), 149);
assert.equal(publishedPlanCost(waiverFile.plans, 4_001), null);

assert.match(homepage, /PUBLISHED_COMPETITOR_PRICING\.map/);
assert.match(homepage, /href=\{competitor\.sourceUrl\}/);
assert.match(homepage, /Plans and features differ/);
assert.match(calculator, /SMARTWAIVER_PRICING\[schedule\]\.plans/);
assert.match(calculator, /no\s+interpolation/i);
assert.doesNotMatch(calculator, /slope|atThousand|entry \+/);

console.log(
  "marketing pricing contracts passed (shared sources, discrete tiers, disclosures)",
);

const volumes = [100, 101, 125, 200, 201, 300, 301, 600, 601, 1000, 2500];
const expected = {
 current: [19, 37, 37, 37, 55, 55, 105, 105, 155, 155, 199],
 announced: [22, 41, 41, 41, 60, 60, 110, 110, 160, 160, 205],
};
for (const period of ['current', 'announced']) {
 const schedule = SMARTWAIVER_PRICING[period];
 volumes.forEach((volume, i) => assert.equal(publishedPlanCost(schedule.plans, volume), expected[period][i], period + ' at ' + volume));
 assert.equal(publishedPlanCost(schedule.plans, 2501), null);
 assert.equal(publishedPlanCost([...schedule.plans].reverse(), 125), expected[period][2]);
 assert.equal(schedule.checkedOn, '2026-09-10');
 assert.ok(!schedule.plans.some(p => p.name === 'Premier'));
}
assert.equal(SMARTWAIVER_PRICING.announced.announcedOn, '2026-09-08');
assert.equal(SMARTWAIVER_PRICING.announced.effectiveFrom, '2026-10-08');
assert.equal(publishedPlanCost([{monthlyWaivers: 200, monthlyUsd: 50}, {monthlyWaivers: 300, monthlyUsd: 40}], 125), 40);
assert.equal(publishedPlanCost([], 100), null);
assert.equal(publishedPlanCost(smartwaiver.plans, NaN), null);
assert.doesNotMatch(calculator, /volume\) \?\? 0/);
console.log('PASS: both schedules, all requested boundaries, 125, unknown coverage, unsorted tiers and lowest price.');

for (const slug of ['smartwaiver-pricing', 'smartwaiver-alternatives', 'waiver-software-cost', 'flatwaiver-vs-smartwaiver', 'waiver-software-for-climbing-gyms']) {
 const article = await source('content/blog/' + slug + '.mdx');
 assert.match(article, /September 8, 2026/);
 assert.match(article, /October 8, 2026/);
 const expectedModified = slug === 'smartwaiver-pricing' ? '2026-09-11' : '2026-09-10';
 assert.ok(article.includes('dateModified: "' + expectedModified + '"'), slug + ' modification date');
 assert.doesNotMatch(article, /re-prices|re-pricing|custom above|Every volume-priced tool/);
}
const pricingArticle = await source('content/blog/smartwaiver-pricing.mdx');
assert.match(pricingArticle, /Upgrading starts a new billing cycle, with credit for unused days on the previous plan\./);
for (const plan of SMARTWAIVER_PRICING.current.plans) {
 const future = SMARTWAIVER_PRICING.announced.plans.find(p => p.name === plan.name);
 const row = '| ' + plan.name + ' | ' + plan.monthlyWaivers.toLocaleString('en-US') + ' | $' + plan.monthlyUsd + ' | $' + future.monthlyUsd + ' |';
 assert.ok(pricingArticle.includes(row), row);
}
console.log('PASS: article dates, complete verified pricing table and corrected upgrade wording.');
