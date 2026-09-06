import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const [page, buttons, creemCheckout, creemPortal, stripeCheckout, stripePortal] =
  await Promise.all([
    source("src/app/(app)/settings/billing/page.tsx"),
    source("src/components/billing-buttons.tsx"),
    source("src/app/api/creem/checkout/route.ts"),
    source("src/app/api/creem/portal/route.ts"),
    source("src/app/api/stripe/checkout/route.ts"),
    source("src/app/api/stripe/portal/route.ts"),
  ]);

assert.match(page, /if \(error \|\| !data\) return <DataLoadError/);
assert.match(page, /const canManage = canManageBilling\(caller\.role\)/);
assert.match(page, /sub\.creem_customer_id[\s\S]*sub\.stripe_customer_id/);
assert.match(page, /BillingActivationNotice active=\{status === "active"\}/);
assert.match(buttons, /router\.refresh\(\)/);
assert.match(buttons, /waiting for secure confirmation from the billing provider/);

for (const route of [creemCheckout, creemPortal, stripeCheckout, stripePortal]) {
  assert.match(route, /canManageBilling\(caller\.role\)/);
  assert.match(route, /status: 403/);
  assert.match(route, /status: 503/);
  assert.match(route, /\.eq\("org_id", caller\.orgId\)/);
}

for (const checkout of [creemCheckout, stripeCheckout]) {
  assert.match(checkout, /subscription\.status === "active"|sub\?\.status === "active"/);
  assert.match(checkout, /already active|Already subscribed/);
}

for (const portal of [creemPortal, stripePortal]) {
  assert.match(portal, /catch \(error\)/);
  assert.match(portal, /status: 502/);
}

console.log("billing journey verification passed (page + 4 provider endpoints)");
