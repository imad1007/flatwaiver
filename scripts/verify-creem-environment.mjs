import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function compile(path, require, process = { env: {} }) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require, process, Error });
  return exports;
}
const environment = compile("../src/lib/creem-environment.ts");
const { resolveCreemServer, CreemConfigurationError } = environment;
for (const mode of ["prod", "live", "production", " LIVE "]) {
  assert.equal(resolveCreemServer(mode, "creem_live_example"), "prod");
}
assert.equal(resolveCreemServer("test", "creem_test_example"), "test");
for (const mode of [undefined, "", "typo"]) {
  assert.throws(() => resolveCreemServer(mode, "creem_live_example"), CreemConfigurationError);
}
assert.throws(() => resolveCreemServer("prod", "creem_test_example"), CreemConfigurationError);
assert.throws(() => resolveCreemServer("test", "creem_live_example"), CreemConfigurationError);

let selectedServer, checkedProduct, checkoutRequest;
const creem = compile("../src/lib/creem.ts", (name) => {
  if (name === "server-only") return {};
  if (name === "@/lib/creem-environment") return environment;
  if (name === "@/lib/config") return { APP: { url: "https://www.flatwaiver.com", priceMonthlyUsd: 19 } };
  if (name === "@/lib/billing-offer") return { billingOfferMismatches: () => [] };
  if (name === "creem") return { Creem: class {
    constructor(options) { selectedServer = options.server; }
    products = { get: async (id) => { checkedProduct = id; return {}; } };
    checkouts = { create: async (request) => { checkoutRequest = request; return { checkoutUrl: "https://www.creem.io/checkout/example" }; } };
  } };
  throw new Error(`Unexpected import: ${name}`);
}, { env: { CREEM_SERVER: "live", CREEM_API_KEY: "creem_live_example", CREEM_PRODUCT_ID: "prod_example" } });
assert.equal(await creem.createCreemCheckoutUrl({ orgId: "org-example", email: "owner@example.com" }), "https://www.creem.io/checkout/example");
assert.equal(selectedServer, "prod", "the deployed live setting must call production");
assert.equal(checkedProduct, "prod_example");
assert.equal(checkoutRequest.productId, "prod_example");
assert.equal(checkoutRequest.metadata.org_id, "org-example");
assert.equal(checkoutRequest.successUrl, "https://www.flatwaiver.com/settings/billing?checkout=success");
console.log("Creem environment and checkout wiring checks passed (mock provider, no payment or network requests).");
