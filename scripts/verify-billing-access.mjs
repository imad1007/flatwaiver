import assert from "node:assert/strict";
import { hasAppAccess, requiresAppAccess } from "../src/lib/billing-access.ts";

const now = Date.parse("2026-09-08T00:00:00Z");
const trial = (trial_ends_at) => ({ status: "trialing", trial_ends_at });
assert.equal(hasAppAccess(trial("2026-09-09T00:00:00Z"), now), true);
assert.equal(hasAppAccess(trial("2026-09-08T00:00:00Z"), now), false);
assert.equal(hasAppAccess(trial("2026-09-07T00:00:00Z"), now), false);
assert.equal(hasAppAccess(trial("invalid"), now), false);
assert.equal(hasAppAccess(trial(null), now), false);
assert.equal(hasAppAccess(null, now), false);
assert.equal(hasAppAccess({ status: "active", trial_ends_at: null }, now), true);
for (const status of ["past_due", "canceled", "unpaid"]) {
  assert.equal(hasAppAccess({ status, trial_ends_at: null }, now), false);
}
for (const path of ["/dashboard", "/waivers/new", "/settings/team", "/signatures", "/help", "/checkin"]) {
  assert.equal(requiresAppAccess(path), true);
}
for (const path of ["/settings/billing", "/api/creem/checkout", "/api/webhooks/creem", "/admin", "/onboarding", "/login"]) {
  assert.equal(requiresAppAccess(path), false);
}
console.log("Billing access checks passed");
