import assert from "node:assert/strict";
import { billingOfferMismatches } from "../src/lib/billing-offer.ts";

const valid = {
  price: 1900,
  currency: "USD",
  billingType: "recurring",
  billingPeriod: "every-month",
  status: "active",
};

assert.deepEqual(billingOfferMismatches(valid, 19), []);

const wrong = billingOfferMismatches(
  {
    price: 3900,
    currency: "EUR",
    billingType: "onetime",
    billingPeriod: "once",
    status: "archived",
  },
  19
);
assert.equal(wrong.length, 5);
assert.match(wrong[0], /price=3900, expected=1900/);
assert.match(wrong[1], /currency=EUR, expected=USD/);
assert.match(wrong[2], /billingType=onetime, expected=recurring/);
assert.match(wrong[3], /billingPeriod=once, expected=every-month/);
assert.match(wrong[4], /status=archived, expected=active/);

assert.deepEqual(
  billingOfferMismatches({ ...valid, currency: "usd" }, 19),
  []
);

console.log("Billing offer checks passed: 3 scenarios");
