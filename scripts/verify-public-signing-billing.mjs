import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { canAcceptPublicSignatures } from "../src/lib/billing-lifecycle.ts";

function load(file, dependencies) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require: (name) => {
    if (!(name in dependencies)) throw new Error("Unexpected dependency: " + name);
    return dependencies[name];
  }, console, Buffer, Date });
  return exports;
}

let subscription;
let reads = 0;
const forbidden = () => { throw new Error("Signing side effect attempted"); };
const admin = {
  from(table) {
    reads++;
    const data = {
      waiver_templates: { id: "template", org_id: "org", name: "Test", slug: "test", current_version_id: "version" },
      template_versions: { id: "version", fields: [] },
      organizations: { name: "Test", branding: {} },
      subscriptions: subscription,
    };
    assert.ok(table in data, "No signature table access when blocked");
    const query = { select(columns) { if (table === "subscriptions") assert.equal(columns, "status, trial_ends_at"); return this; }, eq() { return this; },
      single: async () => ({ data: data[table], error: null }),
      maybeSingle: async () => ({ data: data[table], error: null }) };
    return query;
  },
  storage: { from: forbidden },
};
const loader = load("src/lib/public-waiver.ts", {
  "server-only": {},
  "@/lib/supabase/admin": { createAdminClient(options) {
    assert.equal(options.noStore, true);
    return admin;
  } },
  "@/lib/billing-lifecycle": { canAcceptPublicSignatures },
});
const { z } = await import("zod");
const route = load("src/app/api/sign/[slug]/route.ts", {
  "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
  zod: { z },
  "@/lib/supabase/admin": { createAdminClient: forbidden },
  "@/lib/public-waiver": loader,
  "@/lib/turnstile": { verifyTurnstile: forbidden },
  "@/lib/pdf/waiver-pdf": { renderSignedPdf: forbidden },
  "@/lib/email": { sendFlaggedSignatureEmail: forbidden, sendOwnerNotificationEmail: forbidden, sendSignerCopyEmail: forbidden },
  "@/lib/webhooks": { dispatchWebhooks: forbidden },
  "@/lib/config": { APP: {} },
  "@/lib/signing-validation": { isRealIsoDate: forbidden },
  "@/lib/types": {},
});
const jsx = await import("react/jsx-runtime");
const { renderToStaticMarkup } = await import("react-dom/server");
const page = load("src/app/w/[slug]/page.tsx", {
  "react/jsx-runtime": jsx,
  "next/link": { default: () => null },
  "lucide-react": { CreditCard: () => null, ShieldCheck: () => null },
  "@/lib/public-waiver": loader,
  "@/components/signing-form": { SigningForm: forbidden },
  "@/lib/config": { APP: { name: "FlatWaiver" } },
  "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
});
subscription = {
  status: "trialing", trial_ends_at: "2026-09-21T10:35:50.235Z",
  billing_grace_started_at: null, public_signing_suspended_at: null,
  creem_customer_id: null, creem_subscription_id: null,
};
// Fixed evaluation time: no dependency on wall-clock time.
const originalNow = Date.now;
Date.now = () => Date.parse("2026-09-30T12:00:00Z");
try {
  assert.equal((await loader.getPublishedWaiverBySlug("test")).acceptingSignatures, false);
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: "test" }), searchParams: Promise.resolve({}) }));
  assert.ok(html.includes("This waiver is currently unavailable because the account subscription requires payment."));
  assert.ok(!html.includes("<form"));
  for (let i = 0; i < 2; i++) {
    const response = await route.POST(new Request("https://example.test/api/sign/test", { method: "POST", body: "{}" }), { params: Promise.resolve({ slug: "test" }) });
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /temporarily unavailable/);
  }
  subscription = { ...subscription, status: "active" };
  assert.equal((await loader.getPublishedWaiverBySlug("test")).acceptingSignatures, true);
  assert.ok(reads >= 16, "Each invocation rereads authoritative billing data");
} finally {
  Date.now = originalNow;
}
console.log("PASS: actual loader and POST deny stale trialing with null markers; no signing side effects; active payment restores loader access.");
